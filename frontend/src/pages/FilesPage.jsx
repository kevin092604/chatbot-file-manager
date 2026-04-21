import { useState, useRef } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "../components/Toast";
import { api } from "../api/client";
import FileList from "../components/FileList";
import FileEditor from "../components/FileEditor";

export default function FilesPage() {
  const { isAdmin, vicerrectoria } = useAuth();
  const toast = useToast();
  const canCreate = isAdmin || vicerrectoria !== null;
  const [editing, setEditing] = useState(false);
  const [editFile, setEditFile] = useState(null);
  const [uploadData, setUploadData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [bulkUpload, setBulkUpload] = useState(null);
  const [bulkGroup, setBulkGroup] = useState("");
  const [bulkGroups, setBulkGroups] = useState([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleNew = () => {
    setEditFile(null);
    setUploadData(null);
    setEditing(true);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const processFiles = async (fileList) => {
    const valid = fileList.filter(
      (f) => f.name.endsWith(".md") || f.name.endsWith(".txt")
    );
    if (valid.length === 0) {
      toast.error("No se seleccionaron archivos .md o .txt validos");
      return;
    }

    const items = await Promise.all(
      valid.map(
        (f) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) =>
              resolve({ filename: f.name, content: ev.target.result, status: "pending" });
            reader.readAsText(f);
          })
      )
    );

    setBulkUpload(items);

    if (isAdmin) {
      try {
        const res = await api.listGroups();
        const groups = (res.groups || []).filter((g) => g.name !== "admin");
        setBulkGroups(groups);
        if (groups.length) setBulkGroup(groups[0].name);
      } catch {
        setBulkGroups([]);
      }
    }
  };

  const handleFilesSelected = async (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = "";
    await processFiles(selected);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    if (!canCreate) return;
    const files = Array.from(e.dataTransfer.files || []);
    await processFiles(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (canCreate) setDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleBulkSubmit = async () => {
    const group = isAdmin ? bulkGroup : null;
    const updated = [...bulkUpload];

    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: "uploading" };
      setBulkUpload([...updated]);
      try {
        await api.uploadFile(updated[i].filename, updated[i].content, group);
        updated[i] = { ...updated[i], status: "success" };
      } catch (err) {
        updated[i] = { ...updated[i], status: "error", error: err.message };
      }
      setBulkUpload([...updated]);
    }

    handleRefresh();
  };

  const bulkDone =
    bulkUpload && bulkUpload.every((f) => f.status === "success" || f.status === "error");

  const handleEdit = (file) => {
    setEditFile(file);
    setUploadData(null);
    setEditing(true);
  };

  const handleClose = () => {
    setEditing(false);
    setEditFile(null);
    setUploadData(null);
  };

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className="relative"
    >
      {dragging && (
        <div className="absolute inset-0 bg-blue-50/80 border-2 border-dashed border-blue-400 rounded-xl z-40 flex items-center justify-center">
          <div className="text-center">
            <svg className="w-10 h-10 text-blue-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <p className="text-sm font-medium text-blue-700">Suelta los archivos aquí</p>
            <p className="text-xs text-blue-500 mt-1">.md y .txt</p>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt"
        multiple
        onChange={handleFilesSelected}
        className="hidden"
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Archivos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona los archivos .md de tu vicerrectoría
          </p>
        </div>
        {!editing && canCreate && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleUploadClick}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Subir archivos
            </button>
            <button
              onClick={handleNew}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo archivo
            </button>
          </div>
        )}
      </div>

      {!editing && !canCreate && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
          No tienes un grupo asignado. Contacta al administrador para poder crear archivos.
        </div>
      )}

      {editing ? (
        <FileEditor
          file={editFile}
          upload={uploadData}
          onClose={handleClose}
          onSaved={handleRefresh}
        />
      ) : (
        <FileList
          onEdit={handleEdit}
          onRefresh={handleRefresh}
          refreshKey={refreshKey}
        />
      )}

      {/* Bulk Upload Modal */}
      {bulkUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                Subir {bulkUpload.length} archivo(s)
              </h3>
              <button
                onClick={() => setBulkUpload(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-4">
              {isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Grupo destino
                  </label>
                  <select
                    value={bulkGroup}
                    onChange={(e) => setBulkGroup(e.target.value)}
                    disabled={bulkUpload.some((f) => f.status === "uploading")}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {bulkGroups.map((g) => (
                      <option key={g.name} value={g.name}>
                        {g.name.toUpperCase()}
                        {g.description ? ` — ${g.description}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {bulkUpload.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <span className="text-sm text-gray-800 truncate mr-3">
                      {f.filename}
                    </span>
                    {f.status === "pending" && (
                      <span className="text-xs text-gray-400">Pendiente</span>
                    )}
                    {f.status === "uploading" && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                    )}
                    {f.status === "success" && (
                      <span className="text-xs text-green-600 font-medium">
                        Subido
                      </span>
                    )}
                    {f.status === "error" && (
                      <span
                        className="text-xs text-red-600 font-medium"
                        title={f.error}
                      >
                        Error
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              {bulkDone ? (
                <button
                  onClick={() => setBulkUpload(null)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Cerrar
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setBulkUpload(null)}
                    disabled={bulkUpload.some((f) => f.status === "uploading")}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBulkSubmit}
                    disabled={bulkUpload.some((f) => f.status !== "pending")}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Subir todos
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

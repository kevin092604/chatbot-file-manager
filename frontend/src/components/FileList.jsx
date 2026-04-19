import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "./Toast";
import ConfirmModal from "./ConfirmModal";

const PAGE_SIZE = 10;

export default function FileList({ onEdit, onRefresh, refreshKey }) {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [versions, setVersions] = useState(null);
  const [versionsData, setVersionsData] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    loadFiles();
  }, [refreshKey]);

  const loadFiles = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listFiles();
      setFiles(data.files || []);
      setPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = search
    ? files.filter((f) => f.key.toLowerCase().includes(search.toLowerCase()))
    : files;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedFiles = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleDelete = (file) => {
    setConfirm({
      title: "Eliminar archivo",
      message: `¿Eliminar ${file.key}? Esta accion no se puede deshacer.`,
      confirmText: "Eliminar",
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        setDeleting(file.key);
        try {
          await api.deleteFile(file.key);
          toast.success("Archivo eliminado");
          onRefresh?.();
        } catch (err) {
          toast.error(err.message);
        } finally {
          setDeleting(null);
        }
      },
    });
  };

  const handleDownload = async (file) => {
    try {
      const data = await api.getFile(file.key);
      const blob = new Blob([data.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.key.split("/").pop();
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleShowVersions = async (file) => {
    setVersionsLoading(true);
    setVersions(file.key);
    setVersionsData([]);
    try {
      const data = await api.listVersions(file.key);
      setVersionsData(data.versions || []);
    } catch (err) {
      toast.error(err.message);
      setVersions(null);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleRestore = (versionId) => {
    setConfirm({
      title: "Restaurar version",
      message: "¿Restaurar esta version? El archivo actual sera reemplazado.",
      confirmText: "Restaurar",
      onConfirm: async () => {
        setConfirm(null);
        setRestoring(versionId);
        try {
          await api.restoreVersion(versions, versionId);
          toast.success("Version restaurada");
          setVersions(null);
          onRefresh?.();
        } catch (err) {
          toast.error(err.message);
        } finally {
          setRestoring(null);
        }
      },
    });
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
        {error}
        <button onClick={loadFiles} className="ml-2 underline">
          Reintentar
        </button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No hay archivos</p>
        <p className="text-sm mt-1">Sube tu primer archivo .md</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar archivos..."
          className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No se encontraron archivos para "{search}"
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Archivo
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Tamano
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Modificado
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedFiles.map((file) => (
                <tr
                  key={file.key}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">
                      {file.key}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatSize(file.size)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(file.last_modified).toLocaleString("es-HN")}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => onEdit(file)}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDownload(file)}
                      className="px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      Descargar
                    </button>
                    <button
                      onClick={() => handleShowVersions(file)}
                      className="px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      Versiones
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(file)}
                        disabled={deleting === file.key}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        {deleting === file.key ? "..." : "Eliminar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                {(page - 1) * PAGE_SIZE + 1}-
                {Math.min(page * PAGE_SIZE, filtered.length)} de{" "}
                {filtered.length} archivos
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <span className="text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmText={confirm.confirmText}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Versions Modal */}
      {versions && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                Versiones: {versions}
              </h3>
              <button
                onClick={() => setVersions(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {versionsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              ) : versionsData.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No hay versiones anteriores
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {versionsData.map((v) => (
                    <div
                      key={v.version_id}
                      className="flex items-center justify-between px-6 py-3"
                    >
                      <div>
                        <p className="text-sm text-gray-900">
                          {new Date(v.last_modified).toLocaleString("es-HN")}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatSize(v.size)}
                          {v.is_latest && (
                            <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              Actual
                            </span>
                          )}
                        </p>
                      </div>
                      {!v.is_latest && isAdmin && (
                        <button
                          onClick={() => handleRestore(v.version_id)}
                          disabled={restoring === v.version_id}
                          className="px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
                        >
                          {restoring === v.version_id
                            ? "Restaurando..."
                            : "Restaurar"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

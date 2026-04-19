import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import SimpleMDE from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

export default function FileEditor({ file, upload, onClose, onSaved }) {
  const { isAdmin } = useAuth();
  const [filename, setFilename] = useState(upload?.filename || "");
  const [targetVice, setTargetVice] = useState("");
  const [availableGroups, setAvailableGroups] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initialContent, setInitialContent] = useState(upload?.content || "");
  const contentRef = useRef(upload?.content || "");

  const isNew = !file;

  useEffect(() => {
    if (!isNew || !isAdmin) return;
    api
      .listGroups()
      .then((res) => {
        const groups = (res.groups || []).filter((g) => g.name !== "admin");
        setAvailableGroups(groups);
        if (groups.length && !targetVice) setTargetVice(groups[0].name);
      })
      .catch((err) => setError(`Error cargando grupos: ${err.message}`));
  }, [isNew, isAdmin]);

  useEffect(() => {
    if (file) {
      setLoading(true);
      api
        .getFile(file.key)
        .then((data) => {
          setFilename(file.key.split("/").pop());
          setInitialContent(data.content);
          contentRef.current = data.content;
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [file]);

  const handleChange = useCallback((value) => {
    contentRef.current = value;
  }, []);

  const editorOptions = useMemo(() => ({
    spellChecker: false,
    placeholder: "Escribe el contenido en Markdown...",
    status: ["lines", "words"],
    minHeight: "400px",
  }), []);

  const handleSave = async () => {
    if (!filename.trim()) {
      setError("El nombre del archivo es requerido");
      return;
    }

    const name = filename.endsWith(".md") ? filename : `${filename}.md`;

    setSaving(true);
    setError("");

    try {
      if (isNew) {
        await api.uploadFile(name, contentRef.current, isAdmin ? targetVice : null);
      } else {
        await api.updateFile(file.key, contentRef.current);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {isNew ? "Nuevo archivo" : `Editando: ${file.key}`}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {isNew && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vicerrectoria
              </label>
              <select
                value={targetVice}
                onChange={(e) => setTargetVice(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                {availableGroups.length === 0 && (
                  <option value="">Cargando grupos...</option>
                )}
                {availableGroups.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name.toUpperCase()}
                    {g.description ? ` — ${g.description}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del archivo
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Mi_Documento.md"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <SimpleMDE
          value={initialContent}
          onChange={handleChange}
          options={editorOptions}
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando..." : isNew ? "Crear archivo" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

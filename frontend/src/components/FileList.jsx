import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

export default function FileList({ onEdit, onRefresh, refreshKey }) {
  const { isAdmin } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadFiles();
  }, [refreshKey]);

  const loadFiles = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listFiles();
      setFiles(data.files || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Eliminar ${file.key}?`)) return;

    setDeleting(file.key);
    try {
      await api.deleteFile(file.key);
      onRefresh?.();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeleting(null);
    }
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
        <button onClick={loadFiles} className="ml-2 underline">Reintentar</button>
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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Archivo</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tamano</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Modificado</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-gray-900">{file.key}</span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">{formatSize(file.size)}</td>
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
    </div>
  );
}

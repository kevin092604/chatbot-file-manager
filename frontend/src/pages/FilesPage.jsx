import { useState } from "react";
import FileList from "../components/FileList";
import FileEditor from "../components/FileEditor";

export default function FilesPage() {
  const [editing, setEditing] = useState(false);
  const [editFile, setEditFile] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleNew = () => {
    setEditFile(null);
    setEditing(true);
  };

  const handleEdit = (file) => {
    setEditFile(file);
    setEditing(true);
  };

  const handleClose = () => {
    setEditing(false);
    setEditFile(null);
  };

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Archivos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona los archivos .md de tu vicerrectoria
          </p>
        </div>
        {!editing && (
          <button
            onClick={handleNew}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo archivo
          </button>
        )}
      </div>

      {editing ? (
        <FileEditor file={editFile} onClose={handleClose} onSaved={handleRefresh} />
      ) : (
        <FileList onEdit={handleEdit} onRefresh={handleRefresh} refreshKey={refreshKey} />
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

export default function DashboardPage() {
  const { isAdmin } = useAuth();
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [filesRes, logsRes] = await Promise.all([
          api.listFiles(),
          isAdmin ? api.getAuditLogs() : Promise.resolve({ registros: [] }),
        ]);
        setFiles(filesRes.files || []);
        setLogs(
          (logsRes.registros || [])
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .slice(0, 10)
        );
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin]);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const groups = {};
  files.forEach((f) => {
    const g = f.key.split("/")[0] || "sin grupo";
    groups[g] = (groups[g] || 0) + 1;
  });

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Resumen del sistema</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase">
            Total archivos
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {files.length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase">
            Espacio usado
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatSize(totalSize)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase">Grupos</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {Object.keys(groups).length}
          </p>
        </div>
      </div>

      {/* Files per group */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Archivos por grupo
          </h2>
          {Object.keys(groups).length === 0 ? (
            <p className="text-sm text-gray-500">No hay archivos</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(groups)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-900 uppercase">
                          {name}
                        </span>
                        <span className="text-gray-500">{count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(count / files.length) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Actividad reciente
            </h2>
            {logs.length === 0 ? (
              <p className="text-sm text-gray-500">Sin actividad reciente</p>
            ) : (
              <div className="space-y-3">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 text-sm"
                  >
                    <span
                      className={`mt-0.5 px-1.5 py-0.5 text-xs font-medium rounded ${
                        log.accion === "CREAR"
                          ? "bg-green-100 text-green-700"
                          : log.accion === "ELIMINAR"
                          ? "bg-red-100 text-red-700"
                          : log.accion === "ACTUALIZAR" ||
                            log.accion === "RESTAURAR"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {log.accion}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 truncate">{log.archivo}</p>
                      <p className="text-xs text-gray-500">
                        {log.usuario} &middot;{" "}
                        {new Date(log.fecha).toLocaleString("es-HN")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

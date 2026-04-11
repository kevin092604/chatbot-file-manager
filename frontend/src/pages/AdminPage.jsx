import { useAuth } from "../auth/AuthProvider";

const VICERRECTORIAS = [
  { id: "voae", nombre: "VOAE - Orientacion y Asuntos Estudiantiles" },
  { id: "vra", nombre: "VRA - Relaciones Academicas" },
  { id: "vrip", nombre: "VRIP - Relaciones Internacionales y Posgrados" },
  { id: "vrog", nombre: "VROG - Organizacion y Gestion" },
];

export default function AdminPage() {
  const { isAdmin } = useAuth();

  if (!isAdmin) return null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Administracion</h1>
        <p className="text-sm text-gray-500 mt-1">
          Panel de administracion del sistema
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vicerrectorias */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vicerrectorias</h2>
          <div className="space-y-3">
            {VICERRECTORIAS.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{v.nombre}</p>
                  <p className="text-xs text-gray-500">Carpeta: {v.id}/</p>
                </div>
                <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                  Activa
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Info del sistema */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sistema</h2>
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Estado</p>
              <p className="text-sm font-medium text-green-600">Operativo</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Knowledge Base</p>
              <p className="text-sm font-medium text-gray-900">Amazon Bedrock KB</p>
              <p className="text-xs text-gray-500 mt-1">Sync automatico al modificar archivos</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Almacenamiento</p>
              <p className="text-sm font-medium text-gray-900">Amazon S3</p>
              <p className="text-xs text-gray-500 mt-1">Versionado habilitado</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

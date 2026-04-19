import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import { api } from "../api/client";

function UsersPanel() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", temp_password: "", grupo: "" });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [addingToGroup, setAddingToGroup] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [u, g] = await Promise.all([api.listUsers(), api.listGroups()]);
      setUsers(u.users);
      setGroups(g.groups);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = search
    ? users.filter(
        (u) =>
          (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
          (u.grupos || []).some((g) => g.toLowerCase().includes(search.toLowerCase()))
      )
    : users;

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setFormError("");
    try {
      await api.createUser(form.email, form.temp_password, form.grupo);
      setShowForm(false);
      setForm({ email: "", temp_password: "", grupo: "" });
      toast.success("Usuario creado");
      load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (username) => {
    setConfirm({
      title: "Eliminar usuario",
      message: `¿Eliminar usuario ${username}? Esta accion no se puede deshacer.`,
      confirmText: "Eliminar",
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api.deleteUser(username);
          toast.success("Usuario eliminado");
          load();
        } catch (e) {
          toast.error(e.message);
        }
      },
    });
  };

  const handleAddToGroup = async () => {
    if (selectedGroup)
      try {
        await api.addUserToGroup(addingToGroup, selectedGroup);
        setAddingToGroup(null);
        setSelectedGroup("");
        toast.success("Usuario agregado al grupo");
        load();
      } catch (e) {
        toast.error(e.message);
      }
  };

  const handleRemoveFromGroup = async (username, grupo) => {
    try {
      await api.removeUserFromGroup(username, grupo);
      toast.success("Usuario removido del grupo");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{users.length} usuario(s)</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Nuevo usuario
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-gray-900">Crear usuario</h2>
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {formError}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Correo
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="usuario@unah.edu.hn"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Contrasena temporal
              </label>
              <input
                type="text"
                required
                value={form.temp_password}
                onChange={(e) =>
                  setForm({ ...form, temp_password: e.target.value })
                }
                placeholder="Temp1234!"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Grupo (opcional)
              </label>
              <select
                value={form.grupo}
                onChange={(e) => setForm({ ...form, grupo: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Sin grupo</option>
                {groups.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creando..." : "Crear"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por correo o grupo..."
          className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Correo
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Grupos
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => (
                <tr key={u.username} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        u.status === "CONFIRMED"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {u.status === "CONFIRMED" ? "Activo" : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.grupos.map((g) => (
                        <span
                          key={g}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                        >
                          {g}
                          <button
                            onClick={() => handleRemoveFromGroup(u.username, g)}
                            className="hover:text-red-600 leading-none"
                            title="Quitar del grupo"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                      {u.grupos.length === 0 && (
                        <button
                          onClick={() => {
                            setAddingToGroup(u.username);
                            setSelectedGroup("");
                          }}
                          className="px-2 py-0.5 text-xs text-gray-500 border border-dashed border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-600 transition-colors"
                        >
                          + grupo
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(u.username)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addingToGroup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900">
              Agregar a grupo
            </h3>
            <p className="text-xs text-gray-500">{addingToGroup}</p>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Seleccionar grupo</option>
              {groups.map((g) => (
                <option key={g.name} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleAddToGroup}
                disabled={!selectedGroup}
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Agregar
              </button>
              <button
                onClick={() => setAddingToGroup(null)}
                className="flex-1 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
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
    </div>
  );
}

function GroupsPanel() {
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setGroups((await api.listGroups()).groups);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = search
    ? groups.filter(
        (g) =>
          g.name.toLowerCase().includes(search.toLowerCase()) ||
          (g.description || "").toLowerCase().includes(search.toLowerCase())
      )
    : groups;

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setFormError("");
    try {
      await api.createGroup(form.name, form.description);
      setShowForm(false);
      setForm({ name: "", description: "" });
      toast.success("Grupo creado");
      load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (name) => {
    setConfirm({
      title: "Eliminar grupo",
      message: `¿Eliminar grupo "${name}"? Los usuarios no seran eliminados.`,
      confirmText: "Eliminar",
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api.deleteGroup(name);
          toast.success("Grupo eliminado");
          load();
        } catch (e) {
          toast.error(e.message);
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{groups.length} grupo(s)</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Nuevo grupo
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-gray-900">Crear grupo</h2>
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {formError}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nombre
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="voae"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Descripcion
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Descripcion del grupo"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creando..." : "Crear"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o descripcion..."
          className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Descripcion
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((g) => (
                <tr key={g.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {g.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {g.description || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(g.name)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  );
}

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("usuarios");

  if (!isAdmin) return null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Administracion de Usuarios
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestiona usuarios y grupos del sistema
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab("usuarios")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "usuarios"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Usuarios
        </button>
        <button
          onClick={() => setTab("grupos")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "grupos"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Grupos
        </button>
      </div>

      {tab === "usuarios" && <UsersPanel />}
      {tab === "grupos" && <GroupsPanel />}
    </div>
  );
}

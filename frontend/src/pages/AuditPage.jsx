import { useState, useEffect, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

const ACCIONES = ["CREAR", "ACTUALIZAR", "ELIMINAR"];

const columns = [
  { accessorKey: "fecha", header: "Fecha", cell: ({ getValue }) => new Date(getValue()).toLocaleString("es-HN") },
  { accessorKey: "usuario", header: "Usuario" },
  { accessorKey: "vicerrectoria", header: "Vicerrectoria" },
  { accessorKey: "accion", header: "Accion", cell: ({ getValue }) => {
    const colors = { CREAR: "green", ACTUALIZAR: "blue", ELIMINAR: "red" };
    const color = colors[getValue()] || "gray";
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${color}-100 text-${color}-700`}>
        {getValue()}
      </span>
    );
  }},
  { accessorKey: "archivo", header: "Archivo" },
  { accessorKey: "estado", header: "Estado", cell: ({ getValue }) => (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getValue() === "EXITOSO" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {getValue()}
    </span>
  )},
];

export default function AuditPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { isAdmin } = useAuth();

  // Filtros
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const [sorting, setSorting] = useState([{ id: "fecha", desc: true }]);

  const loadRecords = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filtroUsuario) params.usuario = filtroUsuario;
      if (filtroAccion) params.accion = filtroAccion;
      if (filtroDesde) params.fecha_desde = new Date(filtroDesde).toISOString();
      if (filtroHasta) params.fecha_hasta = new Date(filtroHasta).toISOString();

      const data = await api.getAuditLogs(params);
      setRecords(data.registros || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleFilter = (e) => {
    e.preventDefault();
    loadRecords();
  };

  const handleExport = () => {
    import("xlsx").then(({ utils, writeFile }) => {
      const ws = utils.json_to_sheet(
        records.map((r) => ({
          Fecha: new Date(r.fecha).toLocaleString("es-HN"),
          Usuario: r.usuario,
          Vicerrectoria: r.vicerrectoria,
          Accion: r.accion,
          Archivo: r.archivo,
          Estado: r.estado,
          Detalle: r.detalle,
        }))
      );
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Auditoria");
      writeFile(wb, `auditoria_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  };

  const table = useReactTable({
    data: records,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditoria</h1>
          <p className="text-sm text-gray-500 mt-1">Registro de actividad del sistema</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleExport}
            disabled={records.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Exportar Excel
          </button>
        )}
      </div>

      {/* Filtros */}
      <form onSubmit={handleFilter} className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Usuario</label>
            <input
              type="text"
              value={filtroUsuario}
              onChange={(e) => setFiltroUsuario(e.target.value)}
              placeholder="email@unah.edu.hn"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Accion</label>
            <select
              value={filtroAccion}
              onChange={(e) => setFiltroAccion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Todas</option>
              {ACCIONES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={filtroDesde}
              onChange={(e) => setFiltroDesde(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
              <input
                type="date"
                value={filtroHasta}
                onChange={(e) => setFiltroHasta(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Filtrar
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
          <button onClick={loadRecords} className="ml-2 underline">Reintentar</button>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-gray-200 bg-gray-50">
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className="text-left px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted()] ?? ""}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-12 text-gray-500">
                      No hay registros
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 text-sm text-gray-700">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Paginacion */}
            {table.getPageCount() > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <span className="text-sm text-gray-500">
                  Pagina {table.getState().pagination.pageIndex + 1} de {table.getPageCount()} ({records.length} registros)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

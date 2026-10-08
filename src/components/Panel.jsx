import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import ReciboModal from "./ReciboModal";

function Panel({ usuario }) {
  const [vista, setVista] = useState("recibos"); // "recibos" o "manual"
  const [recibos, setRecibos] = useState([]);
  const [loadingRecibos, setLoadingRecibos] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");

  // Modal de Detalle de Recibo de Compra
  const [reciboModalActivo, setReciboModalActivo] = useState(null);
  const [detallesRecibo, setDetallesRecibo] = useState([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  // Estados para emisión manual de recibos (POS)
  const [productosBD, setProductosBD] = useState([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [items, setItems] = useState([]);

  // Cargar lista de recibos desde el backend
  const cargarRecibos = async () => {
    setLoadingRecibos(true);
    try {
      const res = await fetch("http://localhost:3001/recibos");
      if (res.ok) {
        const data = await res.json();
        setRecibos(data);
      }
    } catch (err) {
      console.warn("Error al cargar recibos de compra:", err.message);
    } finally {
      setLoadingRecibos(false);
    }
  };

  // Cargar productos para emisión manual
  useEffect(() => {
    cargarRecibos();
    fetch("http://localhost:3001/productos")
      .then((res) => res.json())
      .then((data) => setProductosBD(data))
      .catch((err) => console.error("Error cargando productos:", err));
  }, []);

  // Al seleccionar producto en emisión manual
  const handleSelectProducto = (e) => {
    const val = e.target.value;
    setNombre(val);
    const prod = productosBD.find((p) => p.Nombre_Producto === val);
    if (prod) {
      setProductoSeleccionado(prod);
      setPrecio(prod.Precio);
    } else {
      setProductoSeleccionado(null);
      setPrecio("");
    }
  };

  // Abrir modal de detalle completo del recibo al tocar [ Ver recibo ]
  const handleVerRecibo = async (r) => {
    setReciboModalActivo(r);
    setCargandoDetalle(true);
    setDetallesRecibo([]);

    try {
      const res = await fetch(`http://localhost:3001/recibos/${r.idFacturas || r.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetallesRecibo(data.detalles || []);
        if (data.recibo) {
          setReciboModalActivo({ ...r, ...data.recibo });
        }
      }
    } catch (err) {
      console.warn("Nota al cargar detalles de recibo:", err.message);
    } finally {
      setCargandoDetalle(false);
    }
  };

  // Agregar item en emisión manual
  const agregarItem = () => {
    if (!nombre || !productoSeleccionado) {
      Swal.fire({
        icon: "warning",
        title: "Selecciona un producto",
        text: "Por favor elige un producto del catálogo.",
        confirmButtonColor: "#0047AB"
      });
      return;
    }
    if (!precio || Number(precio) <= 0) {
      Swal.fire({
        icon: "warning",
        title: "Precio no válido",
        text: "Ingresa un valor numérico mayor a cero.",
        confirmButtonColor: "#0047AB"
      });
      return;
    }

    const nuevo = {
      idProductos: productoSeleccionado.idProductos,
      nombre: productoSeleccionado.Nombre_Producto,
      precio: Number(precio),
      cantidad: Number(cantidad),
    };

    setItems([...items, nuevo]);
    setNombre("");
    setPrecio("");
    setCantidad(1);
    setProductoSeleccionado(null);
  };

  const eliminarItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalManual = items.reduce((acc, item) => acc + item.precio * item.cantidad, 0);

  // Finalizar recibo manual
  const finalizarReciboManual = async () => {
    if (items.length === 0) return;

    const idUsuario = usuario?.idUsuarios || usuario?.id || 1;
    const dataPedido = {
      idUsuario,
      total: totalManual,
      estado: "Pagado",
      productos: items.map((item) => ({
        idProducto: item.idProductos,
        cantidad: item.cantidad,
        precioUnitario: item.precio
      }))
    };

    try {
      const res = await fetch("http://localhost:3001/recibos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataPedido)
      });

      if (!res.ok) throw new Error("Error al guardar el recibo");
      const resData = await res.json();

      Swal.fire({
        icon: "success",
        title: "Recibo de Compra Emitido",
        text: `Recibo #${resData.numeroRecibo || resData.idFactura} registrado para control contable.`,
        confirmButtonColor: "#20B2AA"
      });

      setItems([]);
      cargarRecibos();
      setVista("recibos");
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo registrar el recibo en la base de datos.",
        confirmButtonColor: "#0047AB"
      });
    }
  };

  // Filtrado de recibos para la vista
  const recibosFiltrados = recibos.filter((r) => {
    const q = busqueda.toLowerCase().trim();
    const matchBusqueda =
      !q ||
      (r.clienteNombre || "").toLowerCase().includes(q) ||
      (r.Nombres || "").toLowerCase().includes(q) ||
      (r.Apellidos || "").toLowerCase().includes(q) ||
      (r.Numero_Recibo || "").toLowerCase().includes(q) ||
      String(r.idFacturas || "").includes(q);

    const matchEstado =
      filtroEstado === "Todos" ||
      (r.Estado || "Pagado").toLowerCase() === filtroEstado.toLowerCase();

    return matchBusqueda && matchEstado;
  });

  // Métricas contables
  const totalIngresos = recibos.reduce((acc, r) => acc + Number(r.Total || 0), 0);
  const totalPagados = recibos.filter((r) => (r.Estado || "Pagado").toLowerCase() === "pagado" || (r.Estado || "").toLowerCase() === "compra realizada").length;
  const totalPendientes = recibos.filter((r) => (r.Estado || "").toLowerCase() === "pendiente").length;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="container py-4"
    >
      {/* MODAL OFICIAL DEL RECIBO */}
      {reciboModalActivo && (
        <ReciboModal 
          recibo={reciboModalActivo} 
          detalles={detallesRecibo} 
          onClose={() => setReciboModalActivo(null)} 
        />
      )}

      {/* ENCABEZADO Y TABS */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <h3 className="fw-extrabold mb-1" style={{ color: "#0047AB", letterSpacing: "0.5px" }}>
            <i className="bi bi-receipt me-2" style={{ color: "#20B2AA" }}></i>
            Módulo de Generar Recibos y Control Contable
          </h3>
          <p className="text-muted mb-0" style={{ fontSize: "14px" }}>
            Visualiza en tiempo real los recibos de compras emitidos por clientes y emite recibos oficiales.
          </p>
        </div>

        {/* NAVEGACIÓN ENTRE BANDEJA Y EMISIÓN MANUAL */}
        <div className="d-flex gap-2">
          <button
            onClick={() => setVista("recibos")}
            className={`btn fw-bold px-3 py-2 d-flex align-items-center gap-1.5 ${
              vista === "recibos" ? "btn-primary" : "btn-outline-secondary"
            }`}
            style={{
              backgroundColor: vista === "recibos" ? "#0047AB" : "transparent",
              borderColor: vista === "recibos" ? "#0047AB" : "#CBD5E1",
              borderRadius: "12px",
              fontSize: "13.5px"
            }}
          >
            <i className="bi bi-card-list"></i> Recibos de Compra ({recibos.length})
          </button>

          <button
            onClick={() => setVista("manual")}
            className={`btn fw-bold px-3 py-2 d-flex align-items-center gap-1.5 ${
              vista === "manual" ? "text-white" : "btn-outline-primary"
            }`}
            style={{
              backgroundColor: vista === "manual" ? "#20B2AA" : "transparent",
              borderColor: "#20B2AA",
              color: vista === "manual" ? "#fff" : "#20B2AA",
              borderRadius: "12px",
              fontSize: "13.5px"
            }}
          >
            <i className="bi bi-plus-circle"></i> Emitir Recibo Manual
          </button>
        </div>
      </div>

      {/* TARJETAS DE MÉTRICAS CONTABLES */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm p-3 h-100" style={{ borderRadius: "16px", backgroundColor: "#F8FAFC" }}>
            <div className="text-muted small fw-semibold mb-1">Total Recibos</div>
            <h4 className="fw-extrabold mb-0" style={{ color: "#0047AB" }}>{recibos.length}</h4>
            <div className="small text-muted mt-1">Registrados en el sistema</div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm p-3 h-100" style={{ borderRadius: "16px", backgroundColor: "#F0FDF4" }}>
            <div className="text-muted small fw-semibold mb-1">Volumen Ingresos</div>
            <h4 className="fw-extrabold mb-0 text-success">${totalIngresos.toLocaleString("es-CO")}</h4>
            <div className="small text-muted mt-1">Recaudación total asentada</div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm p-3 h-100" style={{ borderRadius: "16px", backgroundColor: "#EFF6FF" }}>
            <div className="text-muted small fw-semibold mb-1">Recibos Pagados</div>
            <h4 className="fw-extrabold mb-0 text-primary">{totalPagados}</h4>
            <div className="small text-muted mt-1">Transacciones liquidadas</div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm p-3 h-100" style={{ borderRadius: "16px", backgroundColor: "#FEFCE8" }}>
            <div className="text-muted small fw-semibold mb-1">Recibos Pendientes</div>
            <h4 className="fw-extrabold mb-0 text-warning">{totalPendientes}</h4>
            <div className="small text-muted mt-1">Por confirmar o despachar</div>
          </div>
        </div>
      </div>

      {/* VISTA 1: RECIBOS DE COMPRA (DISEÑO SOLICITADO) */}
      {vista === "recibos" && (
        <div className="card border-0 shadow-sm p-4" style={{ borderRadius: "20px" }}>
          
          {/* HEADER DE LA SECCIÓN SOLICITADA */}
          <div className="text-center pb-3 mb-3 border-bottom">
            <h4 className="fw-extrabold mb-1" style={{ color: "#0047AB", letterSpacing: "1px" }}>
              RECIBOS DE COMPRA
            </h4>
            <p className="text-muted small mb-0">Listado oficial de compras realizadas para control y emisión contable</p>
          </div>

          {/* FILTROS Y BÚSQUEDA */}
          <div className="row g-2 mb-4 align-items-center">
            <div className="col-md-7">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0" style={{ borderRadius: "12px 0 0 12px" }}>
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  style={{ borderRadius: "0 12px 12px 0" }}
                  placeholder="Buscar por cliente o N° de recibo (ej: RC-0001)..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>

            <div className="col-md-5 d-flex justify-content-md-end gap-2">
              {["Todos", "Pagado", "Pendiente"].map((est) => (
                <button
                  key={est}
                  onClick={() => setFiltroEstado(est)}
                  className={`btn btn-sm fw-semibold px-3 py-1.5 rounded-pill ${
                    filtroEstado === est ? "btn-primary text-white" : "btn-light text-secondary"
                  }`}
                  style={{
                    backgroundColor: filtroEstado === est ? "#0047AB" : "#F1F5F9",
                    border: "none",
                    fontSize: "12px"
                  }}
                >
                  {est}
                </button>
              ))}
              <button 
                onClick={cargarRecibos} 
                className="btn btn-sm btn-outline-secondary rounded-pill px-2.5"
                title="Actualizar"
              >
                <i className="bi bi-arrow-clockwise"></i>
              </button>
            </div>
          </div>

          {/* CONTENEDOR DE TARJETAS SOLICITADO */}
          {loadingRecibos ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border text-primary mb-3" role="status"></div>
              <p className="mb-0">Cargando recibos de compra en tiempo real...</p>
            </div>
          ) : recibosFiltrados.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-receipt-cutoff fs-1 d-block mb-2"></i>
              <h6 className="fw-bold">No se encontraron recibos de compra</h6>
              <p className="small mb-0">No hay compras registradas con los filtros aplicados.</p>
            </div>
          ) : (
            <div className="row g-3">
              {recibosFiltrados.map((recibo) => {
                const numRecibo = recibo.Numero_Recibo || `RC-${String(recibo.idFacturas || recibo.id).padStart(4, "0")}`;
                const cliente = recibo.clienteNombre || 
                  (recibo.Nombres ? `${recibo.Nombres} ${recibo.Apellidos || ""}`.trim() : recibo.cliente || "Cliente General");
                
                const fecha = recibo.Fecha ? new Date(recibo.Fecha).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric"
                }) : "20/09/2026";

                const totalStr = Number(recibo.Total || 0).toLocaleString("es-CO");

                return (
                  <div key={recibo.idFacturas || recibo.id} className="col-md-6 col-lg-4">
                    {/* TARJETA CON EL FORMATO EXACTO SOLICITADO */}
                    <motion.div 
                      whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(0, 71, 171, 0.12)" }}
                      className="card border h-100 p-3"
                      style={{ 
                        borderRadius: "16px",
                        backgroundColor: "#FFFFFF",
                        borderColor: "#E2E8F0"
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span 
                          className="fw-extrabold fs-5" 
                          style={{ color: "#0047AB", letterSpacing: "0.5px" }}
                        >
                          {numRecibo}
                        </span>
                        <span 
                          className={`badge rounded-pill px-2.5 py-1 ${
                            (recibo.Estado || "Pagado").toLowerCase() === "pagado" || (recibo.Estado || "").toLowerCase() === "compra realizada"
                              ? "bg-success"
                              : "bg-warning text-dark"
                          }`}
                          style={{ fontSize: "10.5px", fontWeight: "700" }}
                        >
                          {(recibo.Estado || "Pagado").toUpperCase()}
                        </span>
                      </div>

                      <div className="d-flex flex-column gap-1 mb-3 text-secondary" style={{ fontSize: "13.5px" }}>
                        <div>
                          <span className="text-muted fw-medium">Cliente:</span>{" "}
                          <strong className="text-dark">{cliente}</strong>
                        </div>
                        <div>
                          <span className="text-muted fw-medium">Fecha:</span>{" "}
                          <strong className="text-dark">{fecha}</strong>
                        </div>
                        <div>
                          <span className="text-muted fw-medium">Total:</span>{" "}
                          <strong style={{ color: "#0047AB", fontSize: "15px" }}>${totalStr}</strong>
                        </div>
                      </div>

                      <div className="mt-auto pt-2 border-top">
                        <button
                          onClick={() => handleVerRecibo(recibo)}
                          className="btn w-100 fw-bold py-2 d-flex align-items-center justify-content-center gap-1.5"
                          style={{
                            background: "linear-gradient(135deg, #0047AB 0%, #20B2AA 100%)",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "10px",
                            fontSize: "13.5px",
                            boxShadow: "0 3px 12px rgba(32, 178, 170, 0.25)"
                          }}
                        >
                          <i className="bi bi-receipt-cutoff"></i> Ver recibo
                        </button>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* VISTA 2: EMISIÓN MANUAL DE RECIBO (FORMULARIO POS) */}
      {vista === "manual" && (
        <div className="card border-0 shadow-sm p-4" style={{ borderRadius: "20px" }}>
          <h5 className="fw-bold mb-3" style={{ color: "#0047AB" }}>
            <i className="bi bi-pencil-square me-2"></i> Emisión Manual de Recibo de Compra
          </h5>

          <div className="row g-2 align-items-end mb-4">
            <div className="col-md-5">
              <label className="form-label small fw-semibold">Producto del Catálogo</label>
              <select className="form-select" value={nombre} onChange={handleSelectProducto}>
                <option value="">Seleccionar artículo...</option>
                {productosBD.map((p) => (
                  <option key={p.idProductos} value={p.Nombre_Producto}>
                    {p.Nombre_Producto} (${Number(p.Precio).toLocaleString("es-CO")})
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label small fw-semibold">Precio Unitario ($)</label>
              <input
                type="number"
                className="form-control"
                placeholder="Precio"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
              />
            </div>

            <div className="col-md-2">
              <label className="form-label small fw-semibold">Cantidad</label>
              <input
                type="number"
                min="1"
                className="form-control text-center"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>

            <div className="col-md-2">
              <button
                className="btn text-white fw-bold w-100 py-2"
                style={{ backgroundColor: "#20B2AA", borderRadius: "10px" }}
                onClick={agregarItem}
              >
                <i className="bi bi-plus-lg"></i> Agregar
              </button>
            </div>
          </div>

          {/* TABLA DE CONCEPTOS AGREGADOS */}
          <div className="table-responsive mb-3">
            <table className="table align-middle">
              <thead style={{ backgroundColor: "#F8FAFC" }}>
                <tr>
                  <th className="small text-muted py-2 px-3 border-0">PRODUCTO</th>
                  <th className="small text-muted py-2 px-3 border-0 text-center">CANTIDAD</th>
                  <th className="small text-muted py-2 px-3 border-0 text-end">PRECIO</th>
                  <th className="small text-muted py-2 px-3 border-0 text-end">SUBTOTAL</th>
                  <th className="border-0" style={{ width: "40px" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-muted small">
                      No hay artículos agregados al recibo en proceso.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="fw-semibold px-3">{item.nombre}</td>
                      <td className="text-center px-3">{item.cantidad}</td>
                      <td className="text-end px-3 text-muted">${item.precio.toLocaleString("es-CO")}</td>
                      <td className="text-end px-3 fw-bold text-primary">
                        ${(item.precio * item.cantidad).toLocaleString("es-CO")}
                      </td>
                      <td className="text-center px-3">
                        <button
                          className="btn btn-sm btn-outline-danger border-0 rounded-circle"
                          onClick={() => eliminarItem(idx)}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* TOTAL Y ACCIÓN FINALIZAR */}
          <div className="d-flex justify-content-between align-items-center pt-3 border-top">
            <span className="fw-bold fs-6 text-muted">Total a Asentar:</span>
            <span className="fw-extrabold fs-4" style={{ color: "#0047AB" }}>
              ${totalManual.toLocaleString("es-CO")}
            </span>
          </div>

          <button
            onClick={finalizarReciboManual}
            disabled={items.length === 0}
            className="btn text-white fw-bold py-2.5 mt-3 w-100"
            style={{
              background: "linear-gradient(135deg, #0047AB 0%, #20B2AA 100%)",
              borderRadius: "12px"
            }}
          >
            <i className="bi bi-check2-circle me-1"></i> Asentar y Generar Recibo de Compra
          </button>
        </div>
      )}

    </motion.div>
  );
}

export default Panel;
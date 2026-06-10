# CajaLab Roadmap

Objetivo: llevar CajaLab al nivel de un generador serio tipo MakerCase, con archivos confiables para laser y CNC.

## Sprint 1 - Base de precision

- Pruebas automatizadas para geometria, SVG y DXF.
- Unidades mm/in con exportacion en milimetros.
- Medidas internas y externas.
- Presets de material con grosor, kerf y tamano de dedo.
- Persistencia local de configuracion.

## Sprint 2 - Paridad MakerCase

- Union T-slot para tornillos y tuercas.
- Dogbone fillets para CNC/router.
- Configuracion avanzada de exportacion: grosor de linea, colores por capa y nombres de capa.
- Importar/exportar configuracion `.cajalab.json`.

## Sprint 3 - Produccion real

- Rotacion automatica de piezas.
- Nesting basico para ahorrar material.
- Separar piezas en varias camas si no caben.
- Validaciones de fabricacion antes de descargar.

## Sprint 4 - Experiencia premium

- Preview 3D con grosor de material mas realista.
- Flujo por pasos: caja, material, uniones y exportacion.
- Biblioteca de disenos recientes.
- Divisores internos, cajas inclinadas y bisagras flexibles.

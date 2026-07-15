import Link from "next/link";
import { Logo } from "@navaxa/ui";

export const metadata = {
  title: "Términos y privacidad",
  description:
    "Términos de servicio y política de privacidad de navaxa, plataforma de gestión para barberías de Nexo Software SpA.",
};

const VIGENCIA = "15 de julio de 2026";

function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-20 font-display text-2xl font-medium text-foreground">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 font-medium text-foreground">{children}</h3>;
}

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/">
            <Logo size={28} />
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <a href="#terminos" className="hover:text-foreground">Términos</a>
            <a href="#privacidad" className="hover:text-foreground">Privacidad</a>
          </nav>
        </div>
      </header>

      <main className="container max-w-3xl py-12">
        <h1 className="font-display text-3xl font-medium tracking-tight">Legal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Términos de servicio y política de privacidad de <strong>navaxa</strong>, un servicio de{" "}
          <strong>Nexo Software SpA</strong>, RUT 78.397.017-1, Chile ("Nexo Software",
          "nosotros"). Última actualización: {VIGENCIA}.
        </p>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">
          <H2 id="terminos">Términos de servicio</H2>

          <H3>1. El servicio</H3>
          <p>
            navaxa es una plataforma en línea (SaaS) para la gestión de barberías y negocios
            similares: agenda y reservas online, ficha de clientes, historial de cortes,
            comisiones, reportes, notificaciones a clientes y funcionalidades de marketing. El
            servicio se contrata por suscripción y se entrega "tal cual", con actualizaciones
            periódicas. Podemos agregar, modificar o retirar funcionalidades para mejorar el
            producto; si un cambio reduce de forma sustancial lo contratado, te lo avisaremos con
            anticipación razonable.
          </p>

          <H3>2. Cuentas y responsabilidad del negocio</H3>
          <p>
            Al crear una barbería en navaxa declaras tener facultades para representar a ese
            negocio. Eres responsable de la veracidad de los datos ingresados, de mantener la
            confidencialidad de las credenciales de tu equipo y de lo que ocurra bajo tu cuenta.
            Cada barbería es responsable de la relación con sus clientes finales, incluyendo
            obtener los consentimientos que corresponda para registrarlos y contactarlos.
          </p>

          <H3>3. Planes, prueba y pagos</H3>
          <p>
            El registro incluye un período de prueba de 14 días sin medio de pago. Al terminar,
            puedes continuar en el plan Gratis (con límites) o contratar un plan pagado. Los pagos
            se procesan a través de <strong>Webpay (Transbank)</strong>; no almacenamos números de
            tarjeta. El plan anual se cobra por adelantado y equivale a 10 meses del valor mensual.
            Las renovaciones no se cobran automáticamente mientras no exista un mandato de cargo
            recurrente: al vencer el período pagado, la suscripción queda pendiente hasta que la
            renueves. Los precios se publican en pesos chilenos y pueden actualizarse; un cambio de
            precio nunca afecta un período ya pagado.
          </p>

          <H3>4. Abonos de reservas</H3>
          <p>
            Si la barbería activa el cobro de abonos, el cliente final paga a través de Webpay y el
            monto queda asociado a su reserva. La relación comercial por el servicio de barbería
            (incluyendo políticas de devolución del abono ante cancelaciones) es entre la barbería
            y su cliente; navaxa provee la infraestructura de cobro y registro.
          </p>

          <H3>5. Uso aceptable</H3>
          <p>
            No está permitido usar navaxa para actividades ilegales, para enviar comunicaciones no
            solicitadas de forma masiva (spam), para suplantar a terceros ni para intentar vulnerar
            la seguridad de la plataforma o acceder a datos de otras barberías. Podemos suspender
            cuentas que infrinjan estas reglas, avisando cuando sea posible.
          </p>

          <H3>6. Tus datos y término del servicio</H3>
          <p>
            Los datos que cargas (clientes, citas, fotos, configuración) son tuyos. Puedes
            solicitar una exportación escribiéndonos. Si cierras tu cuenta o esta permanece
            impaga, conservaremos tus datos por un período razonable (90 días) por si deseas
            reactivar, y luego podremos eliminarlos definitivamente.
          </p>

          <H3>7. Disponibilidad y responsabilidad</H3>
          <p>
            Trabajamos para mantener el servicio disponible de forma continua, pero no garantizamos
            disponibilidad ininterrumpida (mantenciones, fallas de terceros o fuerza mayor). En la
            máxima medida permitida por la ley chilena, la responsabilidad total de Nexo Software
            frente a un cliente se limita al monto pagado por ese cliente en los 12 meses
            anteriores al hecho que la origina, y no incluye lucro cesante ni daños indirectos.
            Nada en estos términos limita derechos irrenunciables del consumidor.
          </p>

          <H3>8. Ley aplicable</H3>
          <p>
            Estos términos se rigen por las leyes de la República de Chile. Cualquier controversia
            se someterá a los tribunales ordinarios de justicia de Santiago de Chile, sin perjuicio
            de los derechos que la ley otorgue al consumidor para demandar en su domicilio.
          </p>

          <H2 id="privacidad">Política de privacidad</H2>

          <H3>1. Quién es responsable</H3>
          <p>
            Nexo Software SpA, RUT 78.397.017-1, es responsable del tratamiento de los datos de las
            cuentas de la plataforma (dueños y equipos de barberías). Respecto de los datos de los
            clientes finales de cada barbería, la barbería es la responsable y Nexo Software actúa
            como encargado de tratamiento: procesamos esos datos solo para prestar el servicio y
            según las instrucciones del negocio. Tratamos los datos conforme a la Ley N° 19.628
            sobre protección de la vida privada y la normativa que la reemplace o complemente.
          </p>

          <H3>2. Qué datos tratamos</H3>
          <p>
            <strong>De las cuentas</strong>: nombre, email, teléfono, contraseña (almacenada con
            hash, nunca en texto plano) y datos del negocio (nombre, RUT, dirección, logo).
            <br />
            <strong>De los clientes finales</strong> (cargados por la barbería o por el propio
            cliente al reservar): nombre, teléfono, email, historial de citas y servicios, fotos de
            cortes, preferencias y reseñas.
            <br />
            <strong>Técnicos</strong>: registros de acceso y actividad necesarios para seguridad y
            soporte.
          </p>

          <H3>3. Para qué los usamos</H3>
          <p>
            Exclusivamente para operar navaxa: gestionar agenda y reservas, enviar notificaciones
            transaccionales (confirmaciones, recordatorios e invitaciones a reseñar, por email o
            WhatsApp según el plan), procesar pagos, generar reportes para el negocio y, si la
            barbería lo usa, generar recomendaciones de corte con inteligencia artificial a partir
            del historial del cliente. <strong>
              No vendemos datos personales ni los compartimos con terceros para publicidad.
            </strong>
          </p>

          <H3>4. Proveedores que nos ayudan a prestar el servicio</H3>
          <p>
            Compartimos datos con proveedores solo en la medida necesaria: Transbank (pagos
            Webpay), servicios de envío de email y de mensajería WhatsApp (entrega de
            notificaciones), almacenamiento en la nube para imágenes, la infraestructura donde se
            aloja la plataforma y su base de datos, un proveedor de inteligencia artificial para la
            función de recomendación de cortes, y Google (para mostrar las reseñas públicas del
            local que la barbería decida vincular). Estos proveedores procesan los datos solo para
            los fines indicados; algunos pueden almacenarlos fuera de Chile.
          </p>

          <H3>5. Seguridad y retención</H3>
          <p>
            Los datos viajan cifrados (HTTPS/TLS) y se almacenan cifrados en reposo. El acceso está
            segmentado por barbería: ningún negocio puede ver los datos de otro. Conservamos los
            datos mientras la cuenta esté activa y hasta 90 días después de su cierre; los
            respaldos se eliminan de forma rotativa.
          </p>

          <H3>6. Tus derechos</H3>
          <p>
            Puedes solicitar acceso, rectificación, eliminación o portabilidad de tus datos
            escribiendo a{" "}
            <a href="mailto:contacto@nexosoftware.cl" className="underline">
              contacto@nexosoftware.cl
            </a>
            . Si eres cliente final de una barbería, puedes ejercer estos derechos directamente con
            el negocio, o escribirnos y canalizaremos la solicitud. Respondemos dentro de los
            plazos legales y, en general, en menos de 10 días hábiles.
          </p>

          <H3>7. Cambios a esta política</H3>
          <p>
            Si modificamos estos documentos de forma relevante, publicaremos la nueva versión en
            esta página actualizando la fecha de vigencia y, cuando el cambio sea sustancial,
            avisaremos a los dueños de cuenta por email.
          </p>

          <H2>Contacto</H2>
          <p>
            Nexo Software SpA · RUT 78.397.017-1 · Chile
            <br />
            <a href="mailto:contacto@nexosoftware.cl" className="underline">
              contacto@nexosoftware.cl
            </a>
          </p>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Nexo Software SpA · navaxa
      </footer>
    </div>
  );
}

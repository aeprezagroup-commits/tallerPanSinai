/*
ICONO DEL TALLER POR MÁSCARA (PNG)
   Los iconos descargados para el taller son líneas negras sobre fondo
   transparente (RGBA). Al usarlos como máscara CSS se les aplica el color
   heredado (currentColor), de modo que:
     · cada ítem conserva su color de siempre (verde, dorado, azul…),
     · se ven bien en tema claro y en tema oscuro sin invertir los PNG,
     · el ítem activo los pone en blanco solamente con el color del texto.
   No se editó ningún archivo gráfico: se usan tal cual, en public/iconos.
*/

/**
 * @param {{ src: string, size?: number, className?: string, estilo?: React.CSSProperties }} props
 */
export default function IconoMascara({ src, size = 24, className = '', estilo = {} }) {
  const url = `url("${src}")`;

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        backgroundColor: 'currentColor',
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        ...estilo,
      }}
    />
  );
}

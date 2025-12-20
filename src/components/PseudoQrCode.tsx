"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type PseudoQrCodeProps = {
  data: string;
  size?: number;
  className?: string;
  label?: string;
  bgColor?: string;
  fgColor?: string;
  includeMargin?: boolean;
};

export function PseudoQrCode({
  data,
  size = 104,
  className,
  label = "QR code",
  bgColor = "#ffffff",
  fgColor = "#000000",
  includeMargin = true,
}: PseudoQrCodeProps) {
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const nextSvg = await QRCode.toString(data || " ", {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: includeMargin ? 2 : 0,
          width: size,
          color: { dark: fgColor, light: bgColor },
        });

        if (cancelled) return;
        setSvg(nextSvg);
      } catch {
        if (cancelled) return;
        setSvg("");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [data, size, fgColor, bgColor, includeMargin]);

  return (
    <span
      className={className}
      style={{ display: "inline-block", width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <span
        style={{ display: "inline-block", width: size, height: size }}
        aria-hidden="true"
        dangerouslySetInnerHTML={{
          __html: svg
            ? svg.replace("<svg", `<svg focusable="false"`)
            : `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="${bgColor}"/></svg>`,
        }}
      />
    </span>
  );
}

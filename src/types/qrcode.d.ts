declare module "qrcode" {
  type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

  export type QRCodeToStringOptions = {
    type?: "svg" | "terminal" | "utf8";
    errorCorrectionLevel?: ErrorCorrectionLevel;
    margin?: number;
    width?: number;
    color?: { dark?: string; light?: string };
  };

  const QRCode: {
    toString(text: string, options: QRCodeToStringOptions): Promise<string>;
  };

  export default QRCode;
}


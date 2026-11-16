/**
 * ZATCA Phase-1 style TLV QR (Tag-Length-Value) for Saudi e-invoicing.
 * Tags: 1 seller name, 2 VAT number, 3 timestamp, 4 total with VAT, 5 VAT amount.
 * Cryptographic Phase-2 signing can be layered later without changing this payload builder.
 */

function tlv(tag: number, value: string): Uint8Array {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(value);
  const out = new Uint8Array(2 + valueBytes.length);
  out[0] = tag;
  out[1] = valueBytes.length;
  out.set(valueBytes, 2);
  return out;
}

function concatBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export function buildZatcaTlvBase64(params: {
  sellerName: string;
  vatNumber: string;
  timestamp: Date | string;
  totalWithVat: number;
  vatAmount: number;
}) {
  const ts =
    typeof params.timestamp === "string"
      ? params.timestamp
      : params.timestamp.toISOString();
  const payload = concatBytes([
    tlv(1, params.sellerName),
    tlv(2, params.vatNumber || ""),
    tlv(3, ts),
    tlv(4, params.totalWithVat.toFixed(2)),
    tlv(5, params.vatAmount.toFixed(2)),
  ]);
  return Buffer.from(payload).toString("base64");
}

export async function buildZatcaQrDataUrl(tlvBase64: string) {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(tlvBase64, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
  });
}

import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: "#f6f5f2",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 1,
            height: 112,
            background: "#8b5e3c",
            opacity: 0.9,
          }}
        />
        <div
          style={{
            position: "absolute",
            transform: "translate(0, -36px)",
            width: 16,
            height: 16,
            borderRadius: 9999,
            border: "1px solid #8b5e3c",
            background: "#f6f5f2",
          }}
        />
        <div
          style={{
            position: "absolute",
            transform: "translate(0, 44px)",
            fontSize: 38,
            letterSpacing: "-0.08em",
            color: "#0d0d0e",
            fontWeight: 600,
            fontFamily: "Inter, Arial, sans-serif",
          }}
        >
          H
        </div>
      </div>
    ),
    size,
  );
}

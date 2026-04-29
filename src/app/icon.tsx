import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
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
            width: 2,
            height: 324,
            background: "#8b5e3c",
            opacity: 0.9,
          }}
        />
        <div
          style={{
            position: "absolute",
            transform: "translate(0, -96px)",
            width: 44,
            height: 44,
            borderRadius: 9999,
            border: "2px solid #8b5e3c",
            background: "#f6f5f2",
          }}
        />
        <div
          style={{
            position: "absolute",
            transform: "translate(0, 128px)",
            fontSize: 118,
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

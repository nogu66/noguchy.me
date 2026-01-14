import satori from "satori";
import fs from "node:fs";
import path from "node:path";
import loadGoogleFonts from "../loadGoogleFont";

// OGP画像サイズ
const OGP_WIDTH = 1200;
const OGP_HEIGHT = 630;

// 白い領域の座標とサイズ
const WHITE_AREA = {
  top: 35,
  left: 35,
  width: 1130,
  height: 440,
  padding: 40,
};

// テンプレート画像をBase64エンコード（キャッシュ）
let cachedTemplateBase64 = null;

function getTemplateImageBase64() {
  if (cachedTemplateBase64) return cachedTemplateBase64;
  const templatePath = path.join(process.cwd(), "public", "ogp-template.png");
  const imageBuffer = fs.readFileSync(templatePath);
  cachedTemplateBase64 = `data:image/png;base64,${imageBuffer.toString("base64")}`;
  return cachedTemplateBase64;
}

// タイトル省略処理
function truncateTitle(title, maxLength = 80) {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength - 1) + "...";
}

export default async post => {
  const templateBase64 = getTemplateImageBase64();
  const title = truncateTitle(post.data.title);

  return satori(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundImage: `url(${templateBase64})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        },
        children: {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: WHITE_AREA.top + WHITE_AREA.padding,
              left: WHITE_AREA.left + WHITE_AREA.padding,
              width: WHITE_AREA.width - WHITE_AREA.padding * 2,
              height: WHITE_AREA.height - WHITE_AREA.padding * 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
            children: {
              type: "p",
              props: {
                style: {
                  fontSize: 48,
                  fontWeight: "bold",
                  color: "#333333",
                  textAlign: "center",
                  lineHeight: 1.4,
                  wordBreak: "break-word",
                  overflow: "hidden",
                },
                children: title,
              },
            },
          },
        },
      },
    },
    {
      width: OGP_WIDTH,
      height: OGP_HEIGHT,
      embedFont: true,
      fonts: await loadGoogleFonts(title),
    }
  );
};

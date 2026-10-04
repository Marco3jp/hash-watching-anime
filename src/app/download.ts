/** 文字列を JSON のファイルとして保存させる。名前は hash-watching-anime-<名前>-<日付>.json */
export function downloadJson(name: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `hash-watching-anime${name ? `-${name}` : ""}-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

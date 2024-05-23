export const color = 0xc961cc;

export const emojis = {
  true: { id: "854516393788440627" },
  false: { id: "854516395441127504" },
  maybe: { id: "854516398373732383" },
  loading: { id: "1243037879408529510", animated: true },
};

export const getEmoji = (key: boolean | keyof typeof emojis) => {
  const emoji = emojis[String(key)];
  return `<${emoji.animated ? "a" : ""}:${key}:${emoji.id}>`;
};

import type { Player } from "@/app/host/game/types";

export function mergePlayers(incoming: Player[], previous: Player[]) {
  const scoreMap = new Map(previous.map((p) => [p.name, p.score]));
  const seen = new Set<string>();

  return incoming.reduce<Player[]>((acc, player) => {
    if (seen.has(player.name)) return acc;
    seen.add(player.name);
    acc.push({
      name: player.name,
      score: scoreMap.get(player.name) ?? player.score ?? 0,
    });
    return acc;
  }, []);
}

export function avatarForName(name: string) {
  const avatars = [
    "🐶",
    "🐱",
    "🐭",
    "🐹",
    "🐰",
    "🦊",
    "🐻",
    "🐼",
    "🐻‍❄️",
    "🐨",
    "🐯",
    "🦁",
    "🐮",
    "🐷",
    "🐸",
    "🐵",
    "🐔",
    "🐧",
    "🐦",
    "🦉",
    "🦄",
    "🐝",
    "🦋",
    "🐢",
    "🦖",
    "🐙",
    "🦀",
    "🐬",
    "🦈",
    "🦦",
    "🦔",
  ];
  const hash = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return avatars[hash % avatars.length];
}

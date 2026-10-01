/**
 * @param {string} text
 * @param {Iterable<{name: string, source: string}>} commands
 * @returns {string | undefined}
 */
export function expandDollarSkill(text, commands) {
  const match = /^\$([a-z0-9]+(?:-[a-z0-9]+)*)(?=$|\s)/.exec(text);
  if (!match) return undefined;

  const commandName = `skill:${match[1]}`;
  const available = Array.from(commands).some(
    (command) => command.source === "skill" && command.name === commandName,
  );
  if (!available) return undefined;

  // Pi splits skill commands on a literal space, including for multiline input.
  const suffix = text.slice(match[0].length);
  return `/${commandName}${suffix ? ` ${suffix.slice(1)}` : ""}`;
}

/** @param {import('@earendil-works/pi-coding-agent').ExtensionAPI} pi */
export default function dollarSkills(pi) {
  pi.on("input", (event) => {
    if (event.source === "extension" || !event.text.startsWith("$")) {
      return { action: "continue" };
    }

    const text = expandDollarSkill(event.text, pi.getCommands());
    if (text === undefined) return { action: "continue" };
    return { action: "transform", text, images: event.images };
  });
}

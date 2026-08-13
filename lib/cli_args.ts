/** Minimal CLI argument parser for --key value pairs and --flag. */
export function parseArgs(
  args: string[],
  flags: string[] = [],
): Record<string, string | number | undefined> {
  const result: Record<string, string | number | undefined> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (flags.includes(arg) && i + 1 < args.length) {
      const val = args[++i];
      result[arg.replace(/^--/, '')] = isNaN(Number(val)) ? val : Number(val);
    } else if (flags.includes(arg)) {
      result[arg.replace(/^--/, '')] = true;
    }
  }
  return result;
}

export const HELP_TEXT = `Usage: deno run cli.ts [OPTIONS]

Options:
  --theme THEME      Catppuccin theme (macchiato, latte) [default: macchiato]
  --layout LAYOUT    Card layout (portrait, landscape) [default: portrait]
  --count N          Number of cards to generate [default: 1]
  --output-dir DIR   Output directory for PNG files
  --seed N           Seed for reproducible generation
  --help, -h         Show this help message`;

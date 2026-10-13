/** Windows junctions come back from readlink with the `\\?\` long-path prefix. */
export const stripLongPathPrefix = (p: string): string => p.replace(/^\\\\\?\\/, "");

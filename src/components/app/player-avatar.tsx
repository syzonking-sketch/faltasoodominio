import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-9 text-xs",
  md: "size-12 text-sm",
  lg: "size-20 text-lg",
  xl: "size-28 text-2xl",
} as const;

export const GENERIC_AVATARS = [
  { id: "v1", label: "Jogador 1", url: "https://api.dicebear.com/10.x/dylan/svg?seed=Felix&hairColor=af3d3d" },
  { id: "v2", label: "Jogador 2", url: "https://api.dicebear.com/10.x/dylan/svg?seed=Aiden" },
  { 
    id: "v3", 
    label: "Jogador 3", 
    url: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none" shape-rendering="auto" aria-hidden="true" width="512" height="512"><metadata xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><rdf:RDF><rdf:Description><dc:title>Dylan! The Avatar Generator</dc:title><dc:creator>Natalia Spivak</dc:creator><dc:source xsi:type="dcterms:URI">https://www.figma.com/community/file/1356575240759683500</dc:source><dcterms:license xsi:type="dcterms:URI">https://creativecommons.org/licenses/by/4.0/</dcterms:license><dc:rights>Remix of “Dylan! The Avatar Generator” (https://www.figma.com/community/file/1356575240759683500) by “Natalia Spivak”, licensed under “CC BY 4.0” (https://creativecommons.org/licenses/by/4.0/)</dc:rights></rdf:Description></rdf:RDF></metadata><defs><g id="mood-happy-a9564ac1"><path d="M.04 17.04c2.41 9.29 15.16 12.28 22.34 6.67a14 14 0 0 0 4.7-7.22c.36-1.28-1.57-1.8-1.93-.57-1.24 4.23-4.33 7.4-8.68 8.33-3.77.8-8.03-.1-11.05-2.52a10 10 0 0 1-3.45-5.26c-.32-1.25-2.25-.72-1.93.53" fill="black"/></g><g id="hair-spiky-a9564ac1"><path d="m17.55 30.23 2.52-10.73 8.65 2.8 1.51-4.54 9.33 4.35 2.12-4.6 6.96 5.1 5.55-2.33L55.41 31l7.74-8.28-3.9-2.32.83-7.38-3.27.21-1-6.96-4.1 2.53-3.84-5.19-3.64 2.1-9.1-4.3-1 3.6-7.18-1.5v3.8h-9.21l1.64 4.22-8.4 3.16 4.5 2.95-4.5 4.22z" fill="#000000"/></g><clipPath id="clip-a9564ac1"><rect width="80" height="80" rx="0" ry="0"/></clipPath></defs><g clip-path="url(#clip-a9564ac1)"><rect width="80" height="80" fill="#29e051"/><path d="M19.07 30.47s1.57-20.23 21.59-20.23S62.3 30.55 62.3 30.55s9.43-.8 9.43 7.6c0 8.42-9.28 7.13-9.28 7.13S60.9 67.15 42.03 67.15c-21.11 0-23.4-20.8-23.4-20.8s-9 .72-9.93-6.25c-1.08-8.2 10.37-9.64 10.37-9.64" fill="#ffd6c0"/><path d="m64.3 39.49.46-.41.1-.09c.12-.1-.13.1-.02.02l.24-.17q.5-.35 1.06-.62l.26-.12.05-.02.05-.02.58-.21q.6-.18 1.2-.28c.52-.08.85-.76.7-1.23-.18-.56-.67-.8-1.23-.7a9.3 9.3 0 0 0-4.87 2.43c-.38.36-.4 1.06 0 1.4.4.36 1 .4 1.4 0zm-51.8-1.16.14.01c-.27-.02-.11-.01-.04 0l.3.05.52.14.28.09.12.05c.02 0 .22.09.06.02-.14-.1 0-.04.03-.03l.15.06.26.13.47.3.27.22q.47.38.83.83c.33.4 1.07.37 1.41 0 .4-.43.36-.98 0-1.4a7.3 7.3 0 0 0-4.84-2.53c-.52-.06-1.02.5-1 1 .03.59.44.94 1 1m18.3-1.9v4.54c0 .52.46 1.02 1 1s1-.44 1-1V36.4c0-.52-.46-1.02-1-1s-1 .44-1 1M49.2 36l-.15 4.81a1 1 0 0 0 1 1c.56-.02.98-.44 1-1l.15-4.8a1 1 0 0 0-1-1 1 1 0 0 0-1 1" fill="black"/><use transform="translate(27.82 26.75)" href="#mood-happy-a9564ac1"/><use transform="translate(3.78 2.95)" href="#hair-spiky-a9564ac1"/></g></svg>')}` 
  },
  { id: "v4", label: "Jogador 4", url: "https://api.dicebear.com/10.x/dylan/svg?seed=Jordan" },
  { id: "v5", label: "Jogadora 1", url: "https://api.dicebear.com/10.x/dylan/svg?seed=Aneka" },
];

export function PlayerAvatar({
  name,
  nickname,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  nickname?: string | null | undefined;
  photoUrl?: string | null | undefined;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const initials = (nickname ?? name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border-2 border-primary/40 bg-surface-2",
        sizes[size],
        className,
      )}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`Foto de ${nickname ?? name}`}
          loading="lazy"
          className="size-full object-cover bg-surface-1"
        />
      ) : (
        <span className="text-display flex size-full items-center justify-center font-bold text-primary">
          {initials || "?"}
        </span>
      )}
    </div>
  );
}
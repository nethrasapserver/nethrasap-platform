/* Curated icon set for the CMS icon picker. Each `d` is an SVG path drawn at a
   24×24 viewBox in the same stroke style the storefront renders, so what's
   picked here matches the site exactly. The first entries are the icons the
   seed content already uses, so existing badges show as selected. */

export interface IconDef {
  name: string;
  d: string;
}

export const ICON_LIBRARY: IconDef[] = [
  // --- already used by the seeded content ---
  { name: "Fast / lightning", d: "M13 3L4 14h6l-1 7 9-11h-6z" },
  { name: "Cold chain / snowflake", d: "M12 3v18M5 7l14 10M19 7L5 17M12 7l-3-3M12 7l3-3M12 17l-3 3M12 17l3 3" },
  { name: "Verified / shield check", d: "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z" },
  { name: "Pricing / chart", d: "M3 17l5-6 4 3 5-7 4 5" },
  { name: "Delivery truck", d: "M3 16V7h11v9M14 10h4l3 3v3h-7M6.5 19a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zm11 0a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z" },
  { name: "Hospital / building", d: "M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5M9 12h.01M15 12h.01" },
  { name: "Heart / care", d: "M12 21s-7-4.3-9-8.4A5.2 5.2 0 0112 6a5.2 5.2 0 019 6.6c-2 4.1-9 8.4-9 8.4z" },
  { name: "Returns / refresh", d: "M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-4" },
  { name: "Warehouse / network", d: "M3 21V10l9-4 9 4v11zM3 21h18M7 21v-5h4v5M14 21v-5h3v5" },

  // --- general set ---
  { name: "Shopping cart", d: "M6 6h15l-1.5 8H8L6 3H3M9 20a1.6 1.6 0 100-3.2A1.6 1.6 0 009 20zm9 0a1.6 1.6 0 100-3.2A1.6 1.6 0 0018 20z" },
  { name: "Package / box", d: "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" },
  { name: "Shopping bag", d: "M4 7h16M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" },
  { name: "Checkmark", d: "M20 6L9 17l-5-5" },
  { name: "Shield", d: "M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z" },
  { name: "Star", d: "M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z" },
  { name: "Lock / secure", d: "M5 11h14v10H5zM8 11V7a4 4 0 118 0v4" },
  { name: "Award / certified", d: "M12 15a6 6 0 100-12 6 6 0 000 12zM8.5 13.5L7 22l5-3 5 3-1.5-8.5" },
  { name: "Thermometer", d: "M14 14.76V5a2 2 0 10-4 0v9.76a4 4 0 104 0z" },
  { name: "Droplet", d: "M12 3s6 5.7 6 10a6 6 0 01-12 0c0-4.3 6-10 6-10z" },
  { name: "Pill / capsule", d: "M10.5 20.5L4 14a4.95 4.95 0 017-7l6.5 6.5a4.95 4.95 0 01-7 7zM8.5 8.5l7 7" },
  { name: "Stethoscope", d: "M4 3v6a5 5 0 0010 0V3M6 3H3M11 3h3M9 14v2a5 5 0 0010 0v-1M19 12a2 2 0 100-4 2 2 0 000 4z" },
  { name: "Leaf / natural", d: "M11 20A7 7 0 019.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.5 2 8a7 7 0 01-7 7 7 7 0 01-3-.7M2 21c0-3 1-5 3-7" },
  { name: "People / team", d: "M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 11a4 4 0 100-8 4 4 0 000 8zM21 21v-2a4 4 0 00-3-3.9M15 3.1a4 4 0 010 7.8" },
  { name: "Person", d: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1.5-4 5-6 8-6s6.5 2 8 6" },
  { name: "Home", d: "M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z" },
  { name: "Location pin", d: "M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 10a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2z" },
  { name: "Globe / pan-India", d: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c2.5 2.6 4 6 4 9s-1.5 6.4-4 9c-2.5-2.6-4-6-4-9s1.5-6.4 4-9z" },
  { name: "Clock / fast", d: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { name: "Tag / offer", d: "M20.5 13.5l-7 7a1.5 1.5 0 01-2.1 0L3 12V3h9l8.5 8.5a1.5 1.5 0 010 2zM7.5 7.5h.01" },
  { name: "Phone / support", d: "M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.6A2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.5-1.2a2 2 0 012.1-.5c.8.3 1.7.5 2.6.6a2 2 0 011.7 2z" },
  { name: "Document / invoice", d: "M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9zM14 3v6h6M9 13h6M9 17h4" },
  { name: "Chat / help", d: "M8 10h8M8 14h5M21 12a9 9 0 11-4-7.5L21 3z" },
];

// Image catalogue.
// Every entry returns the same local placeholder so the app can be styled
// without any external image dependencies. Swap individual keys to real URLs
// (or to a builder function) when real artwork is ready.
  var PLACEHOLDER = "/elementor-placeholder-image.png";
  function placeholder() {
    return function () { return PLACEHOLDER; };
  }

export const IMG = {
    // hero / lifestyle
    heroWarehouse:   placeholder(),
    heroLab:         placeholder(),
    heroCart:        placeholder(),
    coldChain:       placeholder(),
    pharmacyCounter: placeholder(),
    warehouseAisle:  placeholder(),
    consultation:    placeholder(),
    delivery:        placeholder(),
    teamMeeting:     placeholder(),
    aboutWorkspace:  placeholder(),
    aboutMap:        placeholder(),
    rxTablets:       placeholder(),
    diagnostics:     placeholder(),
    surgical:        placeholder(),
    wellness:        placeholder(),

    // category photography
    catPrescription: placeholder(),
    catOTC:          placeholder(),
    catCardio:       placeholder(),
    catSurgical:     placeholder(),
    catDiagnostics:  placeholder(),
    catMaternal:     placeholder(),
    catColdChain:    placeholder(),
    catWellness:     placeholder(),

    // confirmation / track / general
    boxOnTruck:      placeholder(),
    courier:         placeholder(),
    boxStack:        placeholder(),

    // article / atmospheric
    atmosLab1:       placeholder(),
    atmosLab2:       placeholder(),
    atmosHands:      placeholder(),
  };

/* Per-category cover images, keyed by category slug. Used on the home
 * category grid + categories landing feature row. */
export const CATEGORY_IMAGES = {
  prescription:    "https://news.cuanschutz.edu/hubfs/Ashwagandha%20header.png",
  otc:             "https://sairudransh.in/wp-content/uploads/2025/11/SID-4.jpg",
  cardio:          "https://ayurveda-kerala.org/wp-content/uploads/2025/03/herbs-powder-traditional-spa-wooden-background-1-1-768x512.jpg",
  surgical:        "https://ebyqn4u95z4.exactdn.com/wp-content/uploads/unnamed-1.jpg?strip=all",
  diagnostics:     "https://content.jdmagicbox.com/comp/def_content/siddha-doctors/cropped-ayurveda-utensils-siddha-doctors-3-emhdw.jpg",
  "maternal-child":"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT9rEcIzmADTEv8fk1TriVWN6TIY8aICvh5TQ&s",
  "cold-chain":    "https://www.science.org/cms/asset/26c50d4e-74c9-4123-a4df-845eab39dcbf/Ayurvedic_1280p.jpg",
  wellness:        "https://backgroundimages.withfloats.com/actual/5c134db981134c00014c4975.jpg",
};

/* Per-product cover images keyed by product slug. Curated from Unsplash CDN
 * with an Ayurvedic / herbal-medicine aesthetic. URLs are direct CDN
 * (images.unsplash.com) and survive without API keys; ?w=800 keeps them
 * lightweight on cards. */
const U = (id) => `https://images.unsplash.com/${id}?w=800&q=80&auto=format&fit=crop`;

export const PRODUCT_IMAGES = {
  // ----- Prescription Rx (3) -----
  "amoxicillin-500mg-capsules":       U("photo-1725267882596-2d08e560b250"),
  "azithromycin-500mg-tablets":       U("photo-1611073615264-243646bf4529"),
  "pantoprazole-40mg":                U("photo-1627728724901-e79f35800820"),

  // ----- OTC (6) -----
  "paracetamol-ip-650mg":             U("photo-1620306805869-1bd9ea04b055"),
  "ors-powder-lemon":                 U("photo-1532092367580-3bd5bc78dd9d"),
  "cetirizine-10mg":                  U("photo-1620306806063-b9278074d7be"),
  "ibuprofen-400mg":                  U("photo-1492552085122-36706c238263"),
  "cough-linctus-syrup":              U("photo-1495461199391-8c39ab674295"),
  "levocetirizine-5mg":               U("photo-1506368249639-73a05d6f6488"),

  // ----- Cardio-Metabolic (5) -----
  "glimepiride-2mg-tablets":          U("photo-1521146250551-a5578dcc2e64"),
  "atorvastatin-20mg":                U("photo-1569936906148-06de87cb0681"),
  "metformin-500mg-er":               U("photo-1630623093190-166d69e55f41"),
  "telmisartan-40mg":                 U("photo-1630623092021-5033ec198e4e"),
  "anti-platelet-clopidogrel-75":     U("photo-1631980837306-accb9a02568b"),

  // ----- Surgical & Devices (4) -----
  "surgical-gloves-powder-free":      U("photo-1574670700790-fa314ab37787"),
  "surgical-n95-respirator":          U("photo-1588802060188-ee08afc87823"),
  "disposable-syringe-5ml":           U("photo-1576671081803-5dcb9836dc61"),
  "sutures-vicryl-2-0":               U("photo-1671493234254-15fc6c91aa87"),

  // ----- Diagnostics (4) -----
  "pulse-oximeter-fingertip":         U("photo-1628771065518-0d82f1938462"),
  "digital-bp-monitor-upper-arm":     U("photo-1562243061-204550d8a2c9"),
  "glucometer-strips-50ct":           U("photo-1639772823849-6efbd173043c"),
  "covid-19-rapid-antigen-kit":       U("photo-1631669969504-f35518bf96ba"),

  // ----- Maternal & Child (3) -----
  "pediatric-paracetamol-syrup":      U("photo-1517135399940-2855f5be7c4b"),
  "folic-acid-5mg":                   U("photo-1492778297155-7be4c83960c7"),
  "iron-folic-acid-tablets":          U("photo-1611073761742-bce90ccd60ae"),

  // ----- Cold Chain (2) -----
  "insulin-glargine-100-iu-ml":       U("photo-1664216294580-079bc527ae49"),
  "influenza-vaccine-quadrivalent":   U("photo-1544991875-5dc1b05f607d"),

  // ----- Wellness & Nutra (5) -----
  "multivitamin-effervescent":        "https://thumbs.dreamstime.com/b/ayurvedic-medicine-tablets-205344815.jpg",
  "vitamin-d3-60k-iu-sachet":         U("photo-1630623093163-6ee6c84d61e0"),
  "hand-sanitizer-500ml":             U("photo-1633171029787-3a1022cfc922"),
  "whey-protein-isolate-2kg":         U("photo-1581600140682-d4e68c8cde32"),
  "probiotic-capsules":               U("photo-1659328376647-52ec39d1a5cf"),
};

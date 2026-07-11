// Curated Unsplash photo URLs. Each entry returns a URL builder so you can pass size.
function unsplash(id: string) {
  return function (w?: number, h?: number, q?: number) {
    const width = w || 1200;
    const height = h || 800;
    const quality = q || 75;
    return `https://images.unsplash.com/photo-${id}?w=${width}&h=${height}&fit=crop&auto=format&q=${quality}`;
  };
}

export const IMG = {
  heroWarehouse:   unsplash("1576091160550-2173dba999ef"),
  heroLab:         unsplash("1559757148-5c350d0d3c56"),
  heroCart:        unsplash("1587854692152-cbe660dbde88"),
  coldChain:       unsplash("1607619056574-7b8d3ee536b2"),
  pharmacyCounter: unsplash("1631549916768-4119b2e5f926"),
  warehouseAisle:  unsplash("1586528116311-ad8dd3c8310d"),
  consultation:    unsplash("1571772996211-2f02c9727629"),
  delivery:        unsplash("1601000785686-fafffe50d6ba"),
  teamMeeting:     unsplash("1556761175-5973dc0f32e7"),
  aboutWorkspace:  unsplash("1580281658626-ee379f3cce93"),
  aboutMap:        unsplash("1524661135-423995f22d0b"),
  rxTablets:       unsplash("1584308666744-24d5c474f2ae"),
  diagnostics:     unsplash("1583912086096-8c60d75a53f9"),
  surgical:        unsplash("1551601651-2a8555f1a136"),
  wellness:        unsplash("1599909533730-c75f4dab23f8"),
  catPrescription: unsplash("1584308666744-24d5c474f2ae"),
  catOTC:          unsplash("1626516126441-7bbfe1f3d7f7"),
  catCardio:       unsplash("1559757175-5700dde675bc"),
  catSurgical:     unsplash("1582719471384-894fbb16e074"),
  catDiagnostics:  unsplash("1576091160399-112ba8d25d1d"),
  catMaternal:     unsplash("1555252333-9f8e92e65df9"),
  catColdChain:    unsplash("1607619056574-7b8d3ee536b2"),
  catWellness:     unsplash("1505751172876-fa1923c5c528"),
  boxOnTruck:      unsplash("1605792657660-596af9009e82"),
  courier:         unsplash("1568360905661-2bf28b62b1f4"),
  boxStack:        unsplash("1607082348824-0a96f2a4b9da"),
  atmosLab1:       unsplash("1532187863486-abf9dbad1b69"),
  atmosLab2:       unsplash("1581093588401-fbb62a02f120"),
  atmosHands:      unsplash("1576091160501-bbe57469278b"),
};

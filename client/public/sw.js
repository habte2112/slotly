// ምንም ነገር አይሸጎጥም፤ ጣቢያው ሁልጊዜ አዲሱን ስሪት ያገኛል።
// ይህ ፋይል ያለው ጣቢያው እንደ መተግበሪያ እንዲጫን (installable) ለማድረግ ብቻ ነው።
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
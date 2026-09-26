export const LEGAL_LANGUAGES = ['en','ro','fr','es','pl'] as const;
export type LegalLanguage = typeof LEGAL_LANGUAGES[number];

export type ControlledLegalDocumentCode =
  | 'platform_terms'
  | 'membership_subscription_terms'
  | 'marketplace_transport_terms'
  | 'customer_shipper_terms'
  | 'broker_terms'
  | 'owner_driver_terms'
  | 'carrier_fleet_terms'
  | 'privacy_policy';

export type ControlledLegalSection = { title: string; body: string };
export type ControlledLegalDocument = {
  code: ControlledLegalDocumentCode;
  language: LegalLanguage;
  canonicalLanguage: 'en';
  version: string;
  translationVersion: string;
  title: string;
  intro: string;
  sections: ControlledLegalSection[];
};

export const CONTROLLED_LEGAL_VERSION = '2026-09-26';
export const CONTROLLED_PRIVACY_VERSION = '2026-09-26';

export const LEGAL_LANGUAGE_LABELS: Record<LegalLanguage,string> = {
  en: 'English', ro: 'Română', fr: 'Français', es: 'Español', pl: 'Polski',
};

const shared = {
  en: {
    business: 'You use XDrive in a business capacity and must provide accurate account, identity and commercial information. You must be authorised to act for the business or organisation represented by the account.',
    platformRole: 'XDrive provides a logistics technology platform and marketplace. Unless XDrive expressly agrees otherwise in writing for a specific service, XDrive is not the carrier, transport buyer, payer, employer or contracting transport party for a booking between platform users.',
    booking: 'A load posting is not itself a transport contract. A quote is an offer. A buyer award remains pending until the selected carrier explicitly accepts the final booking terms through the XDrive workflow.',
    payment: 'The business identified in the booking as the transport buyer or ordering party is responsible for paying the performing carrier according to the accepted price, VAT treatment, payment terms, due date and approved adjustments. XDrive does not assume that payment obligation merely because the booking is managed on the platform.',
    amendments: 'Material changes to price, payment terms, route, cargo, timing or other agreed commercial terms must be recorded through the applicable amendment or adjustment workflow. Historical agreement records and evidence must not be silently overwritten.',
    evidence: 'Operational statuses, timestamps, messages, collection evidence, delivery evidence, photographs, signatures, POD, invoices, payment records and disputes may be retained against the booking to operate the service and maintain an audit trail.',
    law: 'These business terms are governed by the law of England and Wales. The courts of England and Wales have exclusive jurisdiction for business users, subject to any mandatory rule that applies otherwise.',
  },
  ro: {
    business: 'Utilizați XDrive în scop profesional și trebuie să furnizați informații corecte despre cont, identitate și relația comercială. Trebuie să aveți autoritatea de a acționa în numele afacerii sau organizației reprezentate de cont.',
    platformRole: 'XDrive furnizează o platformă tehnologică și o piață pentru logistică. Cu excepția cazului în care XDrive acceptă expres altfel, în scris, pentru un serviciu specific, XDrive nu este transportatorul, cumpărătorul transportului, plătitorul, angajatorul sau partea contractantă a transportului pentru o rezervare între utilizatorii platformei.',
    booking: 'Publicarea unei curse nu reprezintă în sine un contract de transport. O cotație este o ofertă. Atribuirea de către buyer rămâne în așteptare până când transportatorul selectat acceptă explicit termenii finali ai rezervării prin fluxul XDrive.',
    payment: 'Compania identificată în rezervare ca transport buyer sau parte care comandă transportul este responsabilă pentru plata transportatorului executant conform prețului acceptat, tratamentului TVA, termenilor de plată, scadenței și ajustărilor aprobate. XDrive nu preia această obligație doar pentru că rezervarea este gestionată pe platformă.',
    amendments: 'Modificările materiale privind prețul, termenii de plată, ruta, marfa, programul sau alți termeni comerciali agreați trebuie înregistrate prin fluxul corespunzător de amendament sau ajustare. Istoricul acordului și dovezile nu pot fi suprascrise în mod ascuns.',
    evidence: 'Statusurile operaționale, marcajele temporale, mesajele, dovezile de colectare și livrare, fotografiile, semnăturile, POD-ul, facturile, plățile și disputele pot fi păstrate împreună cu rezervarea pentru operarea serviciului și menținerea unei piste de audit.',
    law: 'Acești termeni comerciali sunt guvernați de legea Angliei și Țării Galilor. Pentru utilizatorii business, instanțele din Anglia și Țara Galilor au jurisdicție exclusivă, sub rezerva oricărei norme obligatorii aplicabile.',
  },
  fr: {
    business: 'Vous utilisez XDrive dans un cadre professionnel et devez fournir des informations exactes concernant le compte, l’identité et la relation commerciale. Vous devez être autorisé à agir pour l’entreprise ou l’organisation représentée par le compte.',
    platformRole: 'XDrive fournit une plateforme technologique et une place de marché logistique. Sauf accord écrit exprès de XDrive pour un service précis, XDrive n’est ni le transporteur, ni l’acheteur du transport, ni le payeur, ni l’employeur, ni la partie contractante au transport conclu entre utilisateurs.',
    booking: 'La publication d’un transport ne constitue pas à elle seule un contrat. Un devis est une offre. L’attribution par l’acheteur reste en attente jusqu’à l’acceptation explicite des conditions finales par le transporteur sélectionné dans le flux XDrive.',
    payment: 'L’entreprise identifiée dans la réservation comme acheteur du transport ou donneur d’ordre est responsable du paiement du transporteur exécutant conformément au prix accepté, au traitement de la TVA, aux conditions de paiement, à l’échéance et aux ajustements approuvés. XDrive n’assume pas cette obligation du seul fait que la réservation est gérée sur la plateforme.',
    amendments: 'Toute modification importante du prix, des conditions de paiement, de l’itinéraire, de la marchandise, des horaires ou d’autres conditions commerciales convenues doit être enregistrée par le flux d’avenant ou d’ajustement applicable. Les accords et preuves historiques ne doivent pas être remplacés silencieusement.',
    evidence: 'Les statuts opérationnels, horodatages, messages, preuves d’enlèvement et de livraison, photos, signatures, POD, factures, paiements et litiges peuvent être conservés avec la réservation pour exploiter le service et maintenir une piste d’audit.',
    law: 'Ces conditions professionnelles sont régies par le droit d’Angleterre et du Pays de Galles. Pour les utilisateurs professionnels, les tribunaux d’Angleterre et du Pays de Galles ont compétence exclusive, sous réserve de toute règle impérative contraire.',
  },
  es: {
    business: 'Utiliza XDrive con fines empresariales y debe facilitar información exacta sobre la cuenta, la identidad y la relación comercial. Debe estar autorizado para actuar en nombre de la empresa u organización representada por la cuenta.',
    platformRole: 'XDrive proporciona una plataforma tecnológica y un mercado logístico. Salvo que XDrive acuerde expresamente lo contrario por escrito para un servicio concreto, XDrive no es el transportista, comprador del transporte, pagador, empleador ni parte contratante del transporte entre usuarios de la plataforma.',
    booking: 'La publicación de una carga no constituye por sí sola un contrato de transporte. Una cotización es una oferta. La adjudicación del comprador queda pendiente hasta que el transportista seleccionado acepte expresamente las condiciones finales de la reserva mediante el flujo de XDrive.',
    payment: 'La empresa identificada en la reserva como comprador del transporte o parte que realiza el pedido es responsable de pagar al transportista ejecutante conforme al precio aceptado, tratamiento del IVA, condiciones de pago, fecha de vencimiento y ajustes aprobados. XDrive no asume esa obligación únicamente porque la reserva se gestione en la plataforma.',
    amendments: 'Los cambios sustanciales de precio, condiciones de pago, ruta, mercancía, horario u otras condiciones comerciales acordadas deben registrarse mediante el flujo de modificación o ajuste correspondiente. Los acuerdos y pruebas históricos no deben sobrescribirse de forma silenciosa.',
    evidence: 'Los estados operativos, marcas de tiempo, mensajes, pruebas de recogida y entrega, fotografías, firmas, POD, facturas, pagos y disputas pueden conservarse junto con la reserva para operar el servicio y mantener una pista de auditoría.',
    law: 'Estas condiciones empresariales se rigen por la legislación de Inglaterra y Gales. Para usuarios empresariales, los tribunales de Inglaterra y Gales tienen jurisdicción exclusiva, salvo cualquier norma imperativa aplicable.',
  },
  pl: {
    business: 'Korzystasz z XDrive w celach biznesowych i musisz podawać prawidłowe informacje dotyczące konta, tożsamości i relacji handlowej. Musisz być upoważniony do działania w imieniu firmy lub organizacji reprezentowanej przez konto.',
    platformRole: 'XDrive zapewnia platformę technologiczną i rynek logistyczny. O ile XDrive wyraźnie nie uzgodni na piśmie inaczej dla konkretnej usługi, XDrive nie jest przewoźnikiem, nabywcą transportu, płatnikiem, pracodawcą ani stroną umowy transportowej zawieranej między użytkownikami platformy.',
    booking: 'Publikacja ładunku nie stanowi sama w sobie umowy transportowej. Wycena jest ofertą. Wybór przewoźnika przez kupującego pozostaje oczekujący do chwili, gdy wybrany przewoźnik wyraźnie zaakceptuje ostateczne warunki rezerwacji w przepływie XDrive.',
    payment: 'Firma wskazana w rezerwacji jako nabywca transportu lub strona zlecająca odpowiada za zapłatę przewoźnikowi wykonującemu usługę zgodnie z zaakceptowaną ceną, zasadami VAT, terminem płatności, datą wymagalności i zatwierdzonymi korektami. XDrive nie przejmuje tego obowiązku tylko dlatego, że rezerwacja jest obsługiwana na platformie.',
    amendments: 'Istotne zmiany ceny, warunków płatności, trasy, ładunku, terminów lub innych uzgodnionych warunków handlowych muszą być zapisane w odpowiednim procesie aneksu lub korekty. Historyczne umowy i dowody nie mogą być po cichu nadpisywane.',
    evidence: 'Statusy operacyjne, znaczniki czasu, wiadomości, dowody odbioru i dostawy, zdjęcia, podpisy, POD, faktury, płatności i spory mogą być przechowywane przy rezerwacji w celu obsługi usługi i zachowania ścieżki audytowej.',
    law: 'Niniejsze warunki biznesowe podlegają prawu Anglii i Walii. W przypadku użytkowników biznesowych wyłączną jurysdykcję mają sądy Anglii i Walii, z zastrzeżeniem bezwzględnie obowiązujących przepisów.',
  },
} as const;

const titles: Record<ControlledLegalDocumentCode,Record<LegalLanguage,string>> = {
  platform_terms: { en:'XDrive Platform Terms', ro:'Termenii Platformei XDrive', fr:'Conditions de la plateforme XDrive', es:'Términos de la plataforma XDrive', pl:'Warunki platformy XDrive' },
  membership_subscription_terms: { en:'Membership & Subscription Terms', ro:'Termeni de Membership și Abonament', fr:'Conditions d’adhésion et d’abonnement', es:'Términos de membresía y suscripción', pl:'Warunki członkostwa i subskrypcji' },
  marketplace_transport_terms: { en:'Marketplace & Transport Trading Terms', ro:'Termeni Comerciali Marketplace și Transport', fr:'Conditions commerciales de marketplace et transport', es:'Términos comerciales de marketplace y transporte', pl:'Warunki handlowe marketplace i transportu' },
  customer_shipper_terms: { en:'Customer / Shipper Trading Terms', ro:'Termeni Comerciali Customer / Shipper', fr:'Conditions commerciales Client / Expéditeur', es:'Términos comerciales Cliente / Cargador', pl:'Warunki handlowe Klient / Zleceniodawca' },
  broker_terms: { en:'Transport Broker Trading Terms', ro:'Termeni Comerciali Broker de Transport', fr:'Conditions commerciales Courtier de transport', es:'Términos comerciales Broker de transporte', pl:'Warunki handlowe Brokera transportowego' },
  owner_driver_terms: { en:'Owner Driver / Carrier Terms', ro:'Termeni Owner Driver / Carrier', fr:'Conditions Chauffeur-propriétaire / Transporteur', es:'Términos Conductor propietario / Transportista', pl:'Warunki Właściciel-kierowca / Przewoźnik' },
  carrier_fleet_terms: { en:'Carrier / Fleet Trading Terms', ro:'Termeni Comerciali Carrier / Fleet', fr:'Conditions commerciales Transporteur / Flotte', es:'Términos comerciales Transportista / Flota', pl:'Warunki handlowe Przewoźnik / Flota' },
  privacy_policy: { en:'Privacy Policy', ro:'Politica de Confidențialitate', fr:'Politique de confidentialité', es:'Política de privacidad', pl:'Polityka prywatności' },
};

const roleIntro: Record<ControlledLegalDocumentCode,Record<LegalLanguage,string>> = {
  platform_terms: {
    en:'Core rules for access to and use of the XDrive logistics platform.', ro:'Regulile principale pentru accesul și utilizarea platformei logistice XDrive.', fr:'Règles principales d’accès et d’utilisation de la plateforme logistique XDrive.', es:'Reglas principales de acceso y uso de la plataforma logística XDrive.', pl:'Główne zasady dostępu do platformy logistycznej XDrive i korzystania z niej.' },
  membership_subscription_terms: {
    en:'Rules for XDrive membership, free access periods, paid plans, renewal and cancellation.', ro:'Reguli pentru membership XDrive, perioade gratuite, planuri plătite, reînnoire și anulare.', fr:'Règles relatives à l’adhésion XDrive, aux périodes gratuites, aux offres payantes, au renouvellement et à la résiliation.', es:'Reglas sobre membresía XDrive, periodos gratuitos, planes de pago, renovación y cancelación.', pl:'Zasady członkostwa XDrive, okresów bezpłatnych, płatnych planów, odnowienia i anulowania.' },
  marketplace_transport_terms: {
    en:'Commercial rules for posting, quoting, awarding, accepting and performing transport work through XDrive.', ro:'Reguli comerciale pentru publicarea, cotarea, atribuirea, acceptarea și executarea transporturilor prin XDrive.', fr:'Règles commerciales applicables à la publication, au devis, à l’attribution, à l’acceptation et à l’exécution des transports via XDrive.', es:'Reglas comerciales para publicar, cotizar, adjudicar, aceptar y ejecutar transportes mediante XDrive.', pl:'Zasady handlowe dotyczące publikowania, wyceny, przydzielania, akceptacji i realizacji transportów przez XDrive.' },
  customer_shipper_terms: {
    en:'These terms apply when a customer or shipper requests and manages transport supplied by an independent carrier.', ro:'Acești termeni se aplică atunci când un customer sau shipper solicită și gestionează transport furnizat de un transportator independent.', fr:'Ces conditions s’appliquent lorsqu’un client ou expéditeur demande et gère un transport fourni par un transporteur indépendant.', es:'Estos términos se aplican cuando un cliente o cargador solicita y gestiona un transporte prestado por un transportista independiente.', pl:'Warunki te mają zastosowanie, gdy klient lub zleceniodawca zamawia i zarządza transportem wykonywanym przez niezależnego przewoźnika.' },
  broker_terms: {
    en:'These terms apply when a transport broker sources and manages carrier capacity through XDrive.', ro:'Acești termeni se aplică atunci când un broker de transport găsește și gestionează capacitate de transport prin XDrive.', fr:'Ces conditions s’appliquent lorsqu’un courtier en transport recherche et gère de la capacité transporteur via XDrive.', es:'Estos términos se aplican cuando un broker de transporte contrata y gestiona capacidad de transportistas mediante XDrive.', pl:'Warunki te mają zastosowanie, gdy broker transportowy pozyskuje i zarządza zdolnością przewozową przez XDrive.' },
  owner_driver_terms: {
    en:'These terms apply when an owner driver or self-employed carrier quotes for and performs transport work through XDrive.', ro:'Acești termeni se aplică atunci când un owner driver sau transportator independent cotează și execută transporturi prin XDrive.', fr:'Ces conditions s’appliquent lorsqu’un chauffeur-propriétaire ou transporteur indépendant propose et exécute des transports via XDrive.', es:'Estos términos se aplican cuando un conductor propietario o transportista autónomo cotiza y ejecuta transportes mediante XDrive.', pl:'Warunki te mają zastosowanie, gdy właściciel-kierowca lub samozatrudniony przewoźnik wycenia i wykonuje transporty przez XDrive.' },
  carrier_fleet_terms: {
    en:'These terms apply when a carrier or fleet operator quotes, accepts, allocates and performs transport work through XDrive.', ro:'Acești termeni se aplică atunci când un carrier sau fleet operator cotează, acceptă, alocă și execută transporturi prin XDrive.', fr:'Ces conditions s’appliquent lorsqu’un transporteur ou gestionnaire de flotte propose, accepte, affecte et exécute des transports via XDrive.', es:'Estos términos se aplican cuando un transportista u operador de flota cotiza, acepta, asigna y ejecuta transportes mediante XDrive.', pl:'Warunki te mają zastosowanie, gdy przewoźnik lub operator floty wycenia, akceptuje, przydziela i wykonuje transporty przez XDrive.' },
  privacy_policy: {
    en:'How XDrive processes personal data for accounts, marketplace activity, transport operations, evidence and platform security.', ro:'Modul în care XDrive prelucrează date personale pentru conturi, marketplace, operațiuni de transport, dovezi și securitatea platformei.', fr:'Comment XDrive traite les données personnelles pour les comptes, le marketplace, les opérations de transport, les preuves et la sécurité de la plateforme.', es:'Cómo XDrive trata datos personales para cuentas, marketplace, operaciones de transporte, pruebas y seguridad de la plataforma.', pl:'Jak XDrive przetwarza dane osobowe dotyczące kont, rynku, operacji transportowych, dowodów i bezpieczeństwa platformy.' },
};

const headings: Record<LegalLanguage,{business:string;platform:string;booking:string;payment:string;changes:string;evidence:string;law:string}> = {
  en:{business:'Business use and authority',platform:'XDrive platform role',booking:'Quotes, awards and booking acceptance',payment:'Payment responsibility',changes:'Changes and adjustments',evidence:'Operational records and evidence',law:'Governing law'},
  ro:{business:'Utilizare business și autoritate',platform:'Rolul platformei XDrive',booking:'Cotații, atribuiri și acceptarea rezervării',payment:'Responsabilitatea plății',changes:'Modificări și ajustări',evidence:'Înregistrări operaționale și dovezi',law:'Legea aplicabilă'},
  fr:{business:'Utilisation professionnelle et autorité',platform:'Rôle de la plateforme XDrive',booking:'Devis, attribution et acceptation',payment:'Responsabilité du paiement',changes:'Modifications et ajustements',evidence:'Dossiers opérationnels et preuves',law:'Droit applicable'},
  es:{business:'Uso empresarial y autoridad',platform:'Papel de la plataforma XDrive',booking:'Cotizaciones, adjudicación y aceptación',payment:'Responsabilidad de pago',changes:'Cambios y ajustes',evidence:'Registros operativos y pruebas',law:'Ley aplicable'},
  pl:{business:'Użycie biznesowe i upoważnienie',platform:'Rola platformy XDrive',booking:'Wyceny, przydział i akceptacja',payment:'Odpowiedzialność za płatność',changes:'Zmiany i korekty',evidence:'Dokumentacja operacyjna i dowody',law:'Prawo właściwe'},
};

const membershipBody: Record<LegalLanguage,string[]> = {
  en:['Membership access and eligibility are subject to the plan, onboarding and compliance requirements shown by XDrive.','Any free access period is promotional and has no cash value. Paid membership begins only under the disclosed plan and billing arrangement.','Paid membership may renew on the disclosed cycle until cancelled. Cancellation stops future renewal but does not normally reverse a billing period already started unless law or XDrive requires otherwise.','XDrive does not take a percentage commission from transport value under the current membership model unless a different written product is expressly introduced.'],
  ro:['Accesul la membership și eligibilitatea depind de planul, onboarding-ul și cerințele de conformitate afișate de XDrive.','Orice perioadă gratuită este promoțională și nu are valoare în numerar. Membership-ul plătit începe doar conform planului și mecanismului de facturare prezentat.','Membership-ul plătit se poate reînnoi conform ciclului afișat până la anulare. Anularea oprește reînnoirea viitoare, dar în mod normal nu inversează o perioadă de facturare deja începută, cu excepția cazurilor cerute de lege sau acceptate de XDrive.','În modelul curent de membership, XDrive nu reține un comision procentual din valoarea transportului, cu excepția introducerii exprese în scris a unui alt produs.'],
  fr:['L’accès et l’éligibilité dépendent de l’offre, de l’onboarding et des exigences de conformité affichées par XDrive.','Toute période gratuite est promotionnelle et n’a aucune valeur monétaire. L’adhésion payante ne commence que selon l’offre et le mécanisme de facturation présentés.','L’adhésion payante peut se renouveler selon le cycle indiqué jusqu’à résiliation. La résiliation arrête les renouvellements futurs mais n’annule normalement pas une période de facturation déjà commencée, sauf obligation légale ou accord de XDrive.','Dans le modèle actuel, XDrive ne prélève pas de commission proportionnelle à la valeur du transport, sauf introduction expresse et écrite d’un autre produit.'],
  es:['El acceso y la elegibilidad dependen del plan, onboarding y requisitos de cumplimiento mostrados por XDrive.','Cualquier periodo gratuito es promocional y no tiene valor en efectivo. La membresía de pago solo comienza conforme al plan y mecanismo de facturación mostrados.','La membresía de pago puede renovarse según el ciclo indicado hasta su cancelación. La cancelación detiene futuras renovaciones, pero normalmente no revierte un periodo de facturación ya iniciado salvo obligación legal o acuerdo de XDrive.','En el modelo actual, XDrive no cobra una comisión porcentual sobre el valor del transporte salvo que se introduzca expresamente por escrito un producto distinto.'],
  pl:['Dostęp do członkostwa i kwalifikacja zależą od planu, onboardingu i wymogów zgodności przedstawionych przez XDrive.','Każdy bezpłatny okres ma charakter promocyjny i nie ma wartości pieniężnej. Płatne członkostwo rozpoczyna się wyłącznie zgodnie z przedstawionym planem i sposobem rozliczeń.','Płatne członkostwo może odnawiać się zgodnie z podanym cyklem do chwili anulowania. Anulowanie zatrzymuje przyszłe odnowienia, ale zwykle nie cofa już rozpoczętego okresu rozliczeniowego, chyba że wymaga tego prawo lub XDrive postanowi inaczej.','W obecnym modelu XDrive nie pobiera procentowej prowizji od wartości transportu, chyba że wyraźnie wprowadzi na piśmie inny produkt.'],
};

const privacyBodies: Record<LegalLanguage,string[]> = {
  en:['XDrive processes account identity, contact, company, device and security data to create and protect accounts and provide the service.','Transport operations may involve collection and delivery contacts, locations, messages, photographs, signatures, POD and other evidence. Users must only provide personal data that is lawful, accurate and relevant to the booking.','XDrive may disclose necessary data to authorised booking participants, service providers and authorities where required to operate the service, protect users or comply with law.','Retention depends on the type of record, contractual and legal obligations, dispute needs and security requirements. Rights requests may be submitted through the contact details in the public Privacy Policy.'],
  ro:['XDrive prelucrează date despre identitatea contului, contact, companie, dispozitiv și securitate pentru crearea și protejarea conturilor și furnizarea serviciului.','Operațiunile de transport pot include contacte de colectare și livrare, locații, mesaje, fotografii, semnături, POD și alte dovezi. Utilizatorii trebuie să furnizeze doar date personale legale, corecte și relevante pentru rezervare.','XDrive poate comunica datele necesare participanților autorizați la rezervare, furnizorilor de servicii și autorităților atunci când este necesar pentru operarea serviciului, protejarea utilizatorilor sau respectarea legii.','Perioada de păstrare depinde de tipul înregistrării, obligațiile contractuale și legale, necesitățile privind disputele și securitatea. Cererile privind drepturile pot fi trimise prin datele de contact din Politica publică de Confidențialitate.'],
  fr:['XDrive traite les données d’identité de compte, de contact, d’entreprise, d’appareil et de sécurité afin de créer et protéger les comptes et fournir le service.','Les opérations de transport peuvent inclure des contacts d’enlèvement et de livraison, des lieux, messages, photos, signatures, POD et autres preuves. Les utilisateurs doivent fournir uniquement des données personnelles licites, exactes et pertinentes pour la réservation.','XDrive peut communiquer les données nécessaires aux participants autorisés, prestataires et autorités lorsque cela est requis pour exploiter le service, protéger les utilisateurs ou respecter la loi.','La durée de conservation dépend du type de dossier, des obligations contractuelles et légales, des besoins en matière de litige et de sécurité. Les demandes relatives aux droits peuvent être envoyées via les coordonnées de la Politique de confidentialité publique.'],
  es:['XDrive trata datos de identidad de cuenta, contacto, empresa, dispositivo y seguridad para crear y proteger cuentas y prestar el servicio.','Las operaciones de transporte pueden incluir contactos de recogida y entrega, ubicaciones, mensajes, fotografías, firmas, POD y otras pruebas. Los usuarios solo deben aportar datos personales lícitos, exactos y pertinentes para la reserva.','XDrive puede comunicar los datos necesarios a participantes autorizados de la reserva, proveedores y autoridades cuando sea necesario para operar el servicio, proteger a usuarios o cumplir la ley.','La conservación depende del tipo de registro, obligaciones contractuales y legales, necesidades de disputas y seguridad. Las solicitudes de derechos pueden enviarse mediante los datos de contacto de la Política de privacidad pública.'],
  pl:['XDrive przetwarza dane dotyczące tożsamości konta, kontaktów, firmy, urządzenia i bezpieczeństwa w celu tworzenia i ochrony kont oraz świadczenia usługi.','Operacje transportowe mogą obejmować kontakty odbioru i dostawy, lokalizacje, wiadomości, zdjęcia, podpisy, POD i inne dowody. Użytkownicy powinni przekazywać wyłącznie zgodne z prawem, prawidłowe i istotne dane osobowe.','XDrive może przekazywać niezbędne dane upoważnionym uczestnikom rezerwacji, dostawcom usług i organom, gdy jest to konieczne do działania usługi, ochrony użytkowników lub przestrzegania prawa.','Okres przechowywania zależy od rodzaju danych, obowiązków umownych i prawnych, potrzeb związanych ze sporami i bezpieczeństwem. Żądania dotyczące praw można składać za pomocą danych kontaktowych z publicznej Polityki prywatności.'],
};

export const normalizeLegalLanguage = (value: unknown): LegalLanguage =>
  typeof value === 'string' && (LEGAL_LANGUAGES as readonly string[]).includes(value) ? value as LegalLanguage : 'en';

export const buildControlledLegalDocument = (code: ControlledLegalDocumentCode, language: LegalLanguage): ControlledLegalDocument => {
  const s = shared[language];
  const h = headings[language];
  const version = code === 'privacy_policy' ? CONTROLLED_PRIVACY_VERSION : CONTROLLED_LEGAL_VERSION;
  let sections: ControlledLegalSection[];
  if (code === 'membership_subscription_terms') {
    sections = membershipBody[language].map((body,index)=>({title:`${index + 1}. ${['Eligibility and access','Free and paid periods','Renewal and cancellation','Transport fees'][index]}`,body}));
  } else if (code === 'privacy_policy') {
    sections = privacyBodies[language].map((body,index)=>({title:`${index + 1}. ${['Data we process','Transport-operation data','Sharing and disclosures','Retention and rights'][index]}`,body}));
  } else {
    sections = [
      {title:`1. ${h.business}`,body:s.business},
      {title:`2. ${h.platform}`,body:s.platformRole},
      {title:`3. ${h.booking}`,body:s.booking},
      {title:`4. ${h.payment}`,body:s.payment},
      {title:`5. ${h.changes}`,body:s.amendments},
      {title:`6. ${h.evidence}`,body:s.evidence},
      {title:`7. ${h.law}`,body:s.law},
    ];
  }
  return {
    code, language, canonicalLanguage:'en', version,
    translationVersion: `${version}-${language}-1`,
    title: titles[code][language], intro: roleIntro[code][language], sections,
  };
};

export const CONTROLLED_LEGAL_ROUTES: Record<Exclude<ControlledLegalDocumentCode,'privacy_policy'>,string> = {
  platform_terms:'/legal/platform-terms',
  membership_subscription_terms:'/legal/membership-terms',
  marketplace_transport_terms:'/legal/marketplace-transport-terms',
  customer_shipper_terms:'/legal/customer-shipper-terms',
  broker_terms:'/legal/broker-terms',
  owner_driver_terms:'/legal/owner-driver-terms',
  carrier_fleet_terms:'/legal/carrier-fleet-terms',
};

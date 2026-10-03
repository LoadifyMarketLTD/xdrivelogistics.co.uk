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

export const CONTROLLED_LEGAL_VERSION = '2026-09-29-r3';
export const CONTROLLED_PRIVACY_VERSION = '2026-09-26';

export const LEGAL_LANGUAGE_LABELS: Record<LegalLanguage,string> = {
  en: 'English', ro: 'Română', fr: 'Français', es: 'Español', pl: 'Polski',
};

const shared = {
  en: {
    business: 'You use XDrive in a business capacity and must provide accurate account, identity and commercial information. You must be authorised to act for the business or organisation represented by the account.',
    platformRole: 'XDrive provides a logistics technology platform and marketplace. Unless XDrive expressly agrees otherwise in writing for a specific service, XDrive is not the carrier, transport buyer, payer, employer or contracting transport party for a booking between platform users.',
    booking: 'A load posting is not itself a transport contract. A quote is an offer. A buyer award remains pending until the selected carrier explicitly accepts the final booking terms through the XDrive workflow.',
    payment: 'The business identified in the booking as the transport buyer or ordering party is responsible for paying the performing carrier according to the accepted price, VAT treatment, payment terms, due date and approved adjustments. That payment obligation is not conditional on whether the buyer, broker or ordering party has itself been paid by its own customer or any other third party. XDrive does not assume that payment obligation merely because the booking is managed on the platform.',
    amendments: 'Material changes to price, payment terms, route, cargo, timing or other agreed commercial terms must be recorded through the applicable amendment or adjustment workflow. Historical agreement records and evidence must not be silently overwritten.',
    evidence: 'Operational statuses, timestamps, messages, collection evidence, delivery evidence, photographs, signatures, POD, invoices, payment records and disputes may be retained against the booking to operate the service and maintain an audit trail.',
    law: 'These business terms are governed by the law of England and Wales. The courts of England and Wales have exclusive jurisdiction for business users, subject to any mandatory rule that applies otherwise.',
  },
  ro: {
    business: 'Utilizați XDrive în scop profesional și trebuie să furnizați informații corecte despre cont, identitate și relația comercială. Trebuie să aveți autoritatea de a acționa în numele afacerii sau organizației reprezentate de cont.',
    platformRole: 'XDrive furnizează o platformă tehnologică și o piață pentru logistică. Cu excepția cazului în care XDrive acceptă expres altfel, în scris, pentru un serviciu specific, XDrive nu este transportatorul, cumpărătorul transportului, plătitorul, angajatorul sau partea contractantă a transportului pentru o rezervare între utilizatorii platformei.',
    booking: 'Publicarea unei curse nu reprezintă în sine un contract de transport. O cotație este o ofertă. Atribuirea de către buyer rămâne în așteptare până când transportatorul selectat acceptă explicit termenii finali ai rezervării prin fluxul XDrive.',
    payment: 'Compania identificată în rezervare ca transport buyer sau parte care comandă transportul este responsabilă pentru plata transportatorului executant conform prețului acceptat, tratamentului TVA, termenilor de plată, scadenței și ajustărilor aprobate. Această obligație de plată nu depinde de faptul că buyer-ul, brokerul sau partea care comandă transportul a fost sau nu plătită de propriul client ori de un alt terț. XDrive nu preia această obligație doar pentru că rezervarea este gestionată pe platformă.',
    amendments: 'Modificările materiale privind prețul, termenii de plată, ruta, marfa, programul sau alți termeni comerciali agreați trebuie înregistrate prin fluxul corespunzător de amendament sau ajustare. Istoricul acordului și dovezile nu pot fi suprascrise în mod ascuns.',
    evidence: 'Statusurile operaționale, marcajele temporale, mesajele, dovezile de colectare și livrare, fotografiile, semnăturile, POD-ul, facturile, plățile și disputele pot fi păstrate împreună cu rezervarea pentru operarea serviciului și menținerea unei piste de audit.',
    law: 'Acești termeni comerciali sunt guvernați de legea Angliei și Țării Galilor. Pentru utilizatorii business, instanțele din Anglia și Țara Galilor au jurisdicție exclusivă, sub rezerva oricărei norme obligatorii aplicabile.',
  },
  fr: {
    business: 'Vous utilisez XDrive dans un cadre professionnel et devez fournir des informations exactes concernant le compte, l’identité et la relation commerciale. Vous devez être autorisé à agir pour l’entreprise ou l’organisation représentée par le compte.',
    platformRole: 'XDrive fournit une plateforme technologique et une place de marché logistique. Sauf accord écrit exprès de XDrive pour un service précis, XDrive n’est ni le transporteur, ni l’acheteur du transport, ni le payeur, ni l’employeur, ni la partie contractante au transport conclu entre utilisateurs.',
    booking: 'La publication d’un transport ne constitue pas à elle seule un contrat. Un devis est une offre. L’attribution par l’acheteur reste en attente jusqu’à l’acceptation explicite des conditions finales par le transporteur sélectionné dans le flux XDrive.',
    payment: 'L’entreprise identifiée dans la réservation comme acheteur du transport ou donneur d’ordre est responsable du paiement du transporteur exécutant conformément au prix accepté, au traitement de la TVA, aux conditions de paiement, à l’échéance et aux ajustements approuvés. Cette obligation de paiement ne dépend pas du fait que l’acheteur, le courtier ou le donneur d’ordre ait lui-même été payé par son propre client ou par un autre tiers. XDrive n’assume pas cette obligation du seul fait que la réservation est gérée sur la plateforme.',
    amendments: 'Toute modification importante du prix, des conditions de paiement, de l’itinéraire, de la marchandise, des horaires ou d’autres conditions commerciales convenues doit être enregistrée par le flux d’avenant ou d’ajustement applicable. Les accords et preuves historiques ne doivent pas être remplacés silencieusement.',
    evidence: 'Les statuts opérationnels, horodatages, messages, preuves d’enlèvement et de livraison, photos, signatures, POD, factures, paiements et litiges peuvent être conservés avec la réservation pour exploiter le service et maintenir une piste d’audit.',
    law: 'Ces conditions professionnelles sont régies par le droit d’Angleterre et du Pays de Galles. Pour les utilisateurs professionnels, les tribunaux d’Angleterre et du Pays de Galles ont compétence exclusive, sous réserve de toute règle impérative contraire.',
  },
  es: {
    business: 'Utiliza XDrive con fines empresariales y debe facilitar información exacta sobre la cuenta, la identidad y la relación comercial. Debe estar autorizado para actuar en nombre de la empresa u organización representada por la cuenta.',
    platformRole: 'XDrive proporciona una plataforma tecnológica y un mercado logístico. Salvo que XDrive acuerde expresamente lo contrario por escrito para un servicio concreto, XDrive no es el transportista, comprador del transporte, pagador, empleador ni parte contratante del transporte entre usuarios de la plataforma.',
    booking: 'La publicación de una carga no constituye por sí sola un contrato de transporte. Una cotización es una oferta. La adjudicación del comprador queda pendiente hasta que el transportista seleccionado acepte expresamente las condiciones finales de la reserva mediante el flujo de XDrive.',
    payment: 'La empresa identificada en la reserva como comprador del transporte o parte que realiza el pedido es responsable de pagar al transportista ejecutante conforme al precio aceptado, tratamiento del IVA, condiciones de pago, fecha de vencimiento y ajustes aprobados. Esta obligación de pago no depende de que el comprador, broker o parte contratante haya recibido el pago de su propio cliente o de cualquier otro tercero. XDrive no asume esa obligación únicamente porque la reserva se gestione en la plataforma.',
    amendments: 'Los cambios sustanciales de precio, condiciones de pago, ruta, mercancía, horario u otras condiciones comerciales acordadas deben registrarse mediante el flujo de modificación o ajuste correspondiente. Los acuerdos y pruebas históricos no deben sobrescribirse de forma silenciosa.',
    evidence: 'Los estados operativos, marcas de tiempo, mensajes, pruebas de recogida y entrega, fotografías, firmas, POD, facturas, pagos y disputas pueden conservarse junto con la reserva para operar el servicio y mantener una pista de auditoría.',
    law: 'Estas condiciones empresariales se rigen por la legislación de Inglaterra y Gales. Para usuarios empresariales, los tribunales de Inglaterra y Gales tienen jurisdicción exclusiva, salvo cualquier norma imperativa aplicable.',
  },
  pl: {
    business: 'Korzystasz z XDrive w celach biznesowych i musisz podawać prawidłowe informacje dotyczące konta, tożsamości i relacji handlowej. Musisz być upoważniony do działania w imieniu firmy lub organizacji reprezentowanej przez konto.',
    platformRole: 'XDrive zapewnia platformę technologiczną i rynek logistyczny. O ile XDrive wyraźnie nie uzgodni na piśmie inaczej dla konkretnej usługi, XDrive nie jest przewoźnikiem, nabywcą transportu, płatnikiem, pracodawcą ani stroną umowy transportowej zawieranej między użytkownikami platformy.',
    booking: 'Publikacja ładunku nie stanowi sama w sobie umowy transportowej. Wycena jest ofertą. Wybór przewoźnika przez kupującego pozostaje oczekujący do chwili, gdy wybrany przewoźnik wyraźnie zaakceptuje ostateczne warunki rezerwacji w przepływie XDrive.',
    payment: 'Firma wskazana w rezerwacji jako nabywca transportu lub strona zlecająca odpowiada za zapłatę przewoźnikowi wykonującemu usługę zgodnie z zaakceptowaną ceną, zasadami VAT, terminem płatności, datą wymagalności i zatwierdzonymi korektami. Obowiązek ten nie zależy od tego, czy nabywca, broker lub zleceniodawca otrzymał zapłatę od własnego klienta lub innej osoby trzeciej. XDrive nie przejmuje tego obowiązku tylko dlatego, że rezerwacja jest obsługiwana na platformie.',
    amendments: 'Istotne zmiany ceny, warunków płatności, trasy, ładunku, terminów lub innych uzgodnionych warunków handlowych muszą być zapisane w odpowiednim procesie aneksu lub korekty. Historyczne umowy i dowody nie mogą być po cichu nadpisywane.',
    evidence: 'Statusy operacyjne, znaczniki czasu, wiadomości, dowody odbioru i dostawy, zdjęcia, podpisy, POD, faktury, płatności i spory mogą być przechowywane przy rezerwacji w celu obsługi usługi i zachowania ścieżki audytowej.',
    law: 'Niniejsze warunki biznesowe podlegają prawu Anglii i Walii. W przypadku użytkowników biznesowych wyłączną jurysdykcję mają sądy Anglii i Walii, z zastrzeżeniem bezwzględnie obowiązujących przepisów.',
  },
} as const;

const titles: Record<ControlledLegalDocumentCode,Record<LegalLanguage,string>> = {
  platform_terms: { en:'XDrive Platform Terms', ro:'Termenii Platformei XDrive', fr:'Conditions de la plateforme XDrive', es:'Términos de la plataforma XDrive', pl:'Warunki platformy XDrive' },
  membership_subscription_terms: { en:'Membership & Subscription Terms', ro:'Termeni de Membru și Abonament', fr:'Conditions d’adhésion et d’abonnement', es:'Términos de membresía y suscripción', pl:'Warunki członkostwa i subskrypcji' },
  marketplace_transport_terms: { en:'Marketplace & Transport Trading Terms', ro:'Termeni Comerciali Marketplace și Transport', fr:'Conditions commerciales de marketplace et transport', es:'Términos comerciales de marketplace y transporte', pl:'Warunki handlowe marketplace i transportu' },
  customer_shipper_terms: { en:'Customer / Shipper Trading Terms', ro:'Termeni Comerciali Client / Expeditor', fr:'Conditions commerciales Client / Expéditeur', es:'Términos comerciales Cliente / Cargador', pl:'Warunki handlowe Klient / Zleceniodawca' },
  broker_terms: { en:'Transport Broker Trading Terms', ro:'Termeni Comerciali Broker de Transport', fr:'Conditions commerciales Courtier de transport', es:'Términos comerciales Broker de transporte', pl:'Warunki handlowe Brokera transportowego' },
  owner_driver_terms: { en:'Owner Driver / Carrier Terms', ro:'Termeni Owner Driver / Transportator', fr:'Conditions Chauffeur-propriétaire / Transporteur', es:'Términos Conductor propietario / Transportista', pl:'Warunki Właściciel-kierowca / Przewoźnik' },
  carrier_fleet_terms: { en:'Carrier / Fleet Trading Terms', ro:'Termeni Comerciali Transportator / Flotă', fr:'Conditions commerciales Transporteur / Flotte', es:'Términos comerciales Transportista / Flota', pl:'Warunki handlowe Przewoźnik / Flota' },
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

const membershipHeadings: Record<LegalLanguage,string[]> = {
  en:['Eligibility and access','Free and paid periods','Renewal and cancellation','Transport fees'],
  ro:['Eligibilitate și acces','Perioade gratuite și plătite','Reînnoire și anulare','Tarife de transport'],
  fr:['Éligibilité et accès','Périodes gratuites et payantes','Renouvellement et résiliation','Frais de transport'],
  es:['Elegibilidad y acceso','Periodos gratuitos y de pago','Renovación y cancelación','Tarifas de transporte'],
  pl:['Kwalifikowalność i dostęp','Okresy bezpłatne i płatne','Odnowienie i anulowanie','Opłaty transportowe'],
};

const privacyBodies: Record<LegalLanguage,string[]> = {
  en:['XDrive processes account identity, contact, company, device and security data to create and protect accounts and provide the service.','Transport operations may involve collection and delivery contacts, locations, messages, photographs, signatures, POD and other evidence. Users must only provide personal data that is lawful, accurate and relevant to the booking.','XDrive may disclose necessary data to authorised booking participants, service providers and authorities where required to operate the service, protect users or comply with law.','Retention depends on the type of record, contractual and legal obligations, dispute needs and security requirements. Rights requests may be submitted through the contact details in the public Privacy Policy.'],
  ro:['XDrive prelucrează date despre identitatea contului, contact, companie, dispozitiv și securitate pentru crearea și protejarea conturilor și furnizarea serviciului.','Operațiunile de transport pot include contacte de colectare și livrare, locații, mesaje, fotografii, semnături, POD și alte dovezi. Utilizatorii trebuie să furnizeze doar date personale legale, corecte și relevante pentru rezervare.','XDrive poate comunica datele necesare participanților autorizați la rezervare, furnizorilor de servicii și autorităților atunci când este necesar pentru operarea serviciului, protejarea utilizatorilor sau respectarea legii.','Perioada de păstrare depinde de tipul înregistrării, obligațiile contractuale și legale, necesitățile privind disputele și securitatea. Cererile privind drepturile pot fi trimise prin datele de contact din Politica publică de Confidențialitate.'],
  fr:['XDrive traite les données d’identité de compte, de contact, d’entreprise, d’appareil et de sécurité afin de créer et protéger les comptes et fournir le service.','Les opérations de transport peuvent inclure des contacts d’enlèvement et de livraison, des lieux, messages, photos, signatures, POD et autres preuves. Les utilisateurs doivent fournir uniquement des données personnelles licites, exactes et pertinentes pour la réservation.','XDrive peut communiquer les données nécessaires aux participants autorisés, prestataires et autorités lorsque cela est requis pour exploiter le service, protéger les utilisateurs ou respecter la loi.','La durée de conservation dépend du type de dossier, des obligations contractuelles et légales, des besoins en matière de litige et de sécurité. Les demandes relatives aux droits peuvent être envoyées via les coordonnées de la Politique de confidentialité publique.'],
  es:['XDrive trata datos de identidad de cuenta, contacto, empresa, dispositivo y seguridad para crear y proteger cuentas y prestar el servicio.','Las operaciones de transporte pueden incluir contactos de recogida y entrega, ubicaciones, mensajes, fotografías, firmas, POD y otras pruebas. Los usuarios solo deben aportar datos personales lícitos, exactos y pertinentes para la reserva.','XDrive puede comunicar los datos necesarios a participantes autorizados de la reserva, proveedores y autoridades cuando sea necesario para operar el servicio, proteger a usuarios o cumplir la ley.','La conservación depende del tipo de registro, obligaciones contractuales y legales, necesidades de disputas y seguridad. Las solicitudes de derechos pueden enviarse mediante los datos de contacto de la Política de privacidad pública.'],
  pl:['XDrive przetwarza dane dotyczące tożsamości konta, kontaktów, firmy, urządzenia i bezpieczeństwa w celu tworzenia i ochrony kont oraz świadczenia usługi.','Operacje transportowe mogą obejmować kontakty odbioru i dostawy, lokalizacje, wiadomości, zdjęcia, podpisy, POD i inne dowody. Użytkownicy powinni przekazywać wyłącznie zgodne z prawem, prawidłowe i istotne dane osobowe.','XDrive może przekazywać niezbędne dane upoważnionym uczestnikom rezerwacji, dostawcom usług i organom, gdy jest to konieczne do działania usługi, ochrony użytkowników lub przestrzegania prawa.','Okres przechowywania zależy od rodzaju danych, obowiązków umownych i prawnych, potrzeb związanych ze sporami i bezpieczeństwem. Żądania dotyczące praw można składać za pomocą danych kontaktowych z publicznej Polityki prywatności.'],
};

const privacyHeadings: Record<LegalLanguage,string[]> = {
  en:['Data we process','Transport-operation data','Sharing and disclosures','Retention and rights'],
  ro:['Datele pe care le prelucrăm','Date privind operațiunile de transport','Partajare și divulgări','Păstrare și drepturi'],
  fr:['Données que nous traitons','Données des opérations de transport','Partage et divulgations','Conservation et droits'],
  es:['Datos que tratamos','Datos de operaciones de transporte','Compartición y divulgaciones','Conservación y derechos'],
  pl:['Dane, które przetwarzamy','Dane operacji transportowych','Udostępnianie i ujawnianie','Przechowywanie i prawa'],
};

const commercialClauses: Record<LegalLanguage, {
  paymentAck: string;
  buyerRisk: string;
  amendmentsExtras: string;
  collectionEvidence: string;
  brokerRole: string;
  carrierCompliance: string;
  subcontracting: string;
}> = {
  en: {
    paymentAck: 'Each time a transport buyer awards a quote, XDrive requires an authorised user to confirm that the buyer is ordering the transport service and is responsible for paying the awarded carrier under the accepted booking terms and due date. XDrive records that acknowledgement against the award with the acting user, time and applicable terms version.',
    buyerRisk: 'When a business acts as transport buyer, XDrive may apply transport-buyer risk controls at Publish and Award. A new buyer is currently placed in restricted mode by default, with limits of up to 3 active transport commitments and £2,500 outstanding transport exposure unless an authorised Platform Owner reviews or overrides those limits. XDrive may prevent a new publication or award that would exceed the applicable limit. A restriction does not cancel or reduce payment obligations already accepted.',
    amendmentsExtras: 'A material commercial change or additional charge must not overwrite the original agreement. Where the workflow requires counterparty approval, the proposed amendment becomes effective only after the required counterparty accepts it. Approved waiting time, handball, redelivery, additional stops or other extras are retained as traceable adjustments and may form a new version of the commercial agreement.',
    collectionEvidence: 'XDrive may require verified collection and delivery evidence before a booking can progress. Before a job is marked Loaded, the platform may require a verified collection handover and at least one collection photograph, with up to 10 collection photographs linked to that handover. Evidence must relate to the actual booking and must not be fabricated, reused or materially altered to misrepresent performance.',
    brokerRole: 'A broker must accurately disclose the commercial role in which it acts and must not represent a separate customer arrangement as if it changed the carrier-facing agreement. Where the broker is the transport buyer or ordering party, the broker remains responsible for the carrier payment obligation recorded for that booking.',
    carrierCompliance: 'A performing carrier is responsible for using suitable lawful vehicles and personnel and for maintaining the licences, insurance, permissions and compliance documents legally required for the work it undertakes. Acceptance of a booking does not remove those obligations.',
    subcontracting: 'Where subcontracting is permitted, the party arranging the subcontract must not misrepresent who will perform the work and must comply with the applicable disclosure, insurance and legal requirements. Subcontracting does not silently transfer or extinguish an existing contractual obligation unless the affected parties expressly agree through the applicable workflow.',
  },
  ro: {
    paymentAck: 'De fiecare dată când un transport buyer atribuie o cotație, XDrive solicită unui utilizator autorizat să confirme că buyer-ul comandă serviciul de transport și este responsabil pentru plata transportatorului atribuit conform termenilor acceptați ai rezervării și scadenței. XDrive înregistrează această confirmare împreună cu atribuirea, utilizatorul care a acționat, momentul și versiunea aplicabilă a termenilor.',
    buyerRisk: 'Atunci când o companie acționează ca transport buyer, XDrive poate aplica controale de risc la Publish și Award. Un buyer nou este plasat în prezent, implicit, în modul restricted, cu limite de până la 3 angajamente active de transport și £2,500 expunere restantă pentru transport, dacă un Platform Owner autorizat nu revizuiește sau modifică aceste limite. XDrive poate împiedica o publicare sau atribuire nouă care ar depăși limita aplicabilă. O restricție nu anulează și nu reduce obligațiile de plată deja acceptate.',
    amendmentsExtras: 'O modificare comercială materială sau un cost suplimentar nu trebuie să suprascrie acordul inițial. Atunci când fluxul necesită aprobarea contrapărții, amendamentul propus produce efecte numai după acceptarea lui de către contrapartea necesară. Timpul de așteptare, handball, redelivery, opririle suplimentare sau alte extra-costuri aprobate sunt păstrate ca ajustări trasabile și pot forma o nouă versiune a acordului comercial.',
    collectionEvidence: 'XDrive poate solicita dovezi verificate de colectare și livrare înainte ca rezervarea să poată avansa. Înainte ca un job să fie marcat Loaded, platforma poate solicita un handover de colectare verificat și cel puțin o fotografie de colectare, cu până la 10 fotografii de colectare asociate acelui handover. Dovezile trebuie să aparțină rezervării reale și nu pot fi fabricate, reutilizate sau modificate material pentru a denatura executarea.',
    brokerRole: 'Un broker trebuie să declare corect rolul comercial în care acționează și nu trebuie să prezinte un aranjament separat cu clientul ca și cum ar modifica acordul față de transportator. Atunci când brokerul este transport buyer sau partea care comandă transportul, brokerul rămâne responsabil pentru obligația de plată către transportator înregistrată pentru acea rezervare.',
    carrierCompliance: 'Transportatorul executant este responsabil pentru utilizarea unor vehicule și persoane adecvate și legale și pentru menținerea licențelor, asigurărilor, permisiunilor și documentelor de conformitate cerute legal pentru activitatea pe care o execută. Acceptarea unei rezervări nu înlătură aceste obligații.',
    subcontracting: 'Atunci când subcontractarea este permisă, partea care o organizează nu trebuie să denatureze cine va executa transportul și trebuie să respecte cerințele aplicabile de informare, asigurare și legalitate. Subcontractarea nu transferă și nu stinge în mod implicit o obligație contractuală existentă decât dacă părțile afectate convin expres prin fluxul aplicabil.',
  },
  fr: {
    paymentAck: 'Chaque fois qu’un acheteur de transport attribue un devis, XDrive exige qu’un utilisateur autorisé confirme que l’acheteur commande le service de transport et qu’il est responsable du paiement du transporteur retenu selon les conditions de réservation acceptées et la date d’échéance. XDrive enregistre cette confirmation avec l’attribution, l’utilisateur, l’heure et la version applicable des conditions.',
    buyerRisk: 'Lorsqu’une entreprise agit comme acheteur de transport, XDrive peut appliquer des contrôles de risque au moment de la publication et de l’attribution. Un nouvel acheteur est actuellement placé par défaut en mode restreint, avec des limites allant jusqu’à 3 engagements de transport actifs et £2,500 d’exposition de transport impayée, sauf révision ou dérogation par un Platform Owner autorisé. XDrive peut empêcher une nouvelle publication ou attribution qui dépasserait la limite applicable. Une restriction n’annule ni ne réduit les obligations de paiement déjà acceptées.',
    amendmentsExtras: 'Une modification commerciale substantielle ou un coût supplémentaire ne doit pas remplacer l’accord initial. Lorsque le processus exige l’approbation de la contrepartie, l’avenant proposé ne prend effet qu’après son acceptation par la contrepartie requise. Les temps d’attente, manutentions, nouvelles livraisons, arrêts supplémentaires ou autres extras approuvés restent des ajustements traçables et peuvent former une nouvelle version de l’accord commercial.',
    collectionEvidence: 'XDrive peut exiger des preuves vérifiées d’enlèvement et de livraison avant qu’une réservation puisse progresser. Avant qu’un transport soit marqué Loaded, la plateforme peut exiger une remise d’enlèvement vérifiée et au moins une photo d’enlèvement, avec jusqu’à 10 photos liées à cette remise. Les preuves doivent concerner la réservation réelle et ne doivent pas être fabriquées, réutilisées ou matériellement modifiées pour dénaturer l’exécution.',
    brokerRole: 'Un courtier doit déclarer avec exactitude le rôle commercial dans lequel il agit et ne doit pas présenter un arrangement séparé avec son client comme modifiant l’accord conclu avec le transporteur. Lorsque le courtier est l’acheteur du transport ou le donneur d’ordre, il demeure responsable de l’obligation de paiement du transporteur enregistrée pour la réservation.',
    carrierCompliance: 'Le transporteur exécutant est responsable de l’utilisation de véhicules et de personnel adaptés et licites ainsi que du maintien des licences, assurances, autorisations et documents de conformité légalement requis pour le travail entrepris. L’acceptation d’une réservation ne supprime pas ces obligations.',
    subcontracting: 'Lorsque la sous-traitance est autorisée, la partie qui l’organise ne doit pas dissimuler l’identité de l’exécutant et doit respecter les exigences applicables de divulgation, d’assurance et de droit. La sous-traitance ne transfère ni n’éteint silencieusement une obligation contractuelle existante sauf accord exprès des parties concernées dans le processus applicable.',
  },
  es: {
    paymentAck: 'Cada vez que un comprador de transporte adjudica una cotización, XDrive exige que un usuario autorizado confirme que el comprador encarga el servicio de transporte y que es responsable de pagar al transportista adjudicado conforme a las condiciones aceptadas de la reserva y a la fecha de vencimiento. XDrive registra esta confirmación con la adjudicación, el usuario actuante, la hora y la versión aplicable de los términos.',
    buyerRisk: 'Cuando una empresa actúa como comprador de transporte, XDrive puede aplicar controles de riesgo en Publish y Award. Actualmente, un comprador nuevo se sitúa por defecto en modo restringido, con límites de hasta 3 compromisos de transporte activos y £2,500 de exposición de transporte pendiente, salvo revisión o modificación por un Platform Owner autorizado. XDrive puede impedir una nueva publicación o adjudicación que supere el límite aplicable. Una restricción no cancela ni reduce obligaciones de pago ya aceptadas.',
    amendmentsExtras: 'Un cambio comercial sustancial o un cargo adicional no debe sobrescribir el acuerdo original. Cuando el flujo requiera aprobación de la contraparte, la modificación propuesta solo entra en vigor después de que la contraparte necesaria la acepte. El tiempo de espera, manipulación, nueva entrega, paradas adicionales u otros extras aprobados se conservan como ajustes trazables y pueden formar una nueva versión del acuerdo comercial.',
    collectionEvidence: 'XDrive puede exigir pruebas verificadas de recogida y entrega antes de que una reserva pueda avanzar. Antes de marcar un trabajo como Loaded, la plataforma puede exigir una entrega de recogida verificada y al menos una fotografía de recogida, con hasta 10 fotografías vinculadas a esa entrega. Las pruebas deben corresponder a la reserva real y no deben fabricarse, reutilizarse ni modificarse materialmente para falsear la ejecución.',
    brokerRole: 'Un broker debe declarar correctamente el papel comercial en el que actúa y no debe presentar un acuerdo separado con su cliente como si modificara el acuerdo frente al transportista. Cuando el broker sea el comprador del transporte o la parte que lo encarga, seguirá siendo responsable de la obligación de pago al transportista registrada para esa reserva.',
    carrierCompliance: 'El transportista ejecutante es responsable de utilizar vehículos y personal adecuados y legales y de mantener las licencias, seguros, permisos y documentos de cumplimiento exigidos legalmente para el trabajo que realiza. La aceptación de una reserva no elimina esas obligaciones.',
    subcontracting: 'Cuando se permita la subcontratación, la parte que la organice no debe falsear quién realizará el trabajo y debe cumplir los requisitos aplicables de información, seguro y legalidad. La subcontratación no transfiere ni extingue silenciosamente una obligación contractual existente salvo acuerdo expreso de las partes afectadas mediante el flujo aplicable.',
  },
  pl: {
    paymentAck: 'Za każdym razem, gdy nabywca transportu przyznaje zlecenie na podstawie wyceny, XDrive wymaga od upoważnionego użytkownika potwierdzenia, że nabywca zamawia usługę transportową i odpowiada za zapłatę wybranemu przewoźnikowi zgodnie z zaakceptowanymi warunkami rezerwacji i terminem płatności. XDrive zapisuje to potwierdzenie wraz z przyznaniem zlecenia, użytkownikiem, czasem i obowiązującą wersją warunków.',
    buyerRisk: 'Gdy firma działa jako nabywca transportu, XDrive może stosować kontrole ryzyka na etapie Publish i Award. Nowy nabywca jest obecnie domyślnie objęty trybem restricted, z limitem do 3 aktywnych zobowiązań transportowych i £2,500 niespłaconej ekspozycji transportowej, chyba że upoważniony Platform Owner dokona przeglądu lub zmiany tych limitów. XDrive może zablokować nową publikację lub przyznanie zlecenia, które przekroczyłoby obowiązujący limit. Ograniczenie nie anuluje ani nie zmniejsza wcześniej zaakceptowanych obowiązków płatniczych.',
    amendmentsExtras: 'Istotna zmiana handlowa lub dodatkowa opłata nie może nadpisywać pierwotnej umowy. Jeżeli proces wymaga akceptacji drugiej strony, proponowany aneks staje się skuteczny dopiero po wymaganej akceptacji. Zatwierdzony czas oczekiwania, ręczny przeładunek, ponowna dostawa, dodatkowe postoje lub inne dodatki pozostają możliwymi do prześledzenia korektami i mogą tworzyć nową wersję umowy handlowej.',
    collectionEvidence: 'XDrive może wymagać zweryfikowanych dowodów odbioru i dostawy, zanim rezerwacja będzie mogła przejść dalej. Przed oznaczeniem zlecenia jako Loaded platforma może wymagać zweryfikowanego przekazania przy odbiorze i co najmniej jednego zdjęcia odbioru, przy czym z przekazaniem można powiązać do 10 zdjęć. Dowody muszą dotyczyć rzeczywistej rezerwacji i nie mogą być fałszowane, ponownie wykorzystywane ani istotnie zmieniane w celu zniekształcenia wykonania.',
    brokerRole: 'Broker musi prawidłowo ujawnić rolę handlową, w jakiej działa, i nie może przedstawiać odrębnego uzgodnienia z klientem tak, jakby zmieniało ono umowę wobec przewoźnika. Jeżeli broker jest nabywcą transportu lub zleceniodawcą, pozostaje odpowiedzialny za obowiązek zapłaty przewoźnikowi zapisany dla danej rezerwacji.',
    carrierCompliance: 'Przewoźnik wykonujący usługę odpowiada za użycie odpowiednich i zgodnych z prawem pojazdów oraz personelu, a także za utrzymanie licencji, ubezpieczeń, zezwoleń i dokumentów zgodności prawnie wymaganych do wykonywanej pracy. Akceptacja rezerwacji nie usuwa tych obowiązków.',
    subcontracting: 'Jeżeli podwykonawstwo jest dozwolone, strona je organizująca nie może wprowadzać w błąd co do tego, kto wykona pracę, i musi spełniać obowiązujące wymagania informacyjne, ubezpieczeniowe i prawne. Podwykonawstwo nie przenosi ani nie wygasza po cichu istniejącego obowiązku umownego, chyba że zainteresowane strony wyraźnie uzgodnią to w odpowiednim procesie.',
  },
};

const commercialHeadings: Record<LegalLanguage, {
  paymentAck: string;
  buyerRisk: string;
  amendmentsExtras: string;
  collectionEvidence: string;
  brokerRole: string;
  carrierCompliance: string;
  subcontracting: string;
}> = {
  en: { paymentAck:'Per-award payment acknowledgement', buyerRisk:'Transport buyer risk and exposure controls', amendmentsExtras:'Amendments and approved extras', collectionEvidence:'Collection and delivery evidence', brokerRole:'Broker role and carrier-facing obligations', carrierCompliance:'Carrier compliance', subcontracting:'Subcontracting and onward performance' },
  ro: { paymentAck:'Confirmarea obligației de plată la fiecare atribuire', buyerRisk:'Controale de risc și expunere pentru transport buyer', amendmentsExtras:'Amendamente și costuri suplimentare aprobate', collectionEvidence:'Dovezi de colectare și livrare', brokerRole:'Rolul brokerului și obligațiile față de transportator', carrierCompliance:'Conformitatea transportatorului', subcontracting:'Subcontractare și executare ulterioară' },
  fr: { paymentAck:'Confirmation de l’obligation de paiement à chaque attribution', buyerRisk:'Contrôles de risque et d’exposition de l’acheteur de transport', amendmentsExtras:'Avenants et frais supplémentaires approuvés', collectionEvidence:'Preuves d’enlèvement et de livraison', brokerRole:'Rôle du courtier et obligations envers le transporteur', carrierCompliance:'Conformité du transporteur', subcontracting:'Sous-traitance et exécution ultérieure' },
  es: { paymentAck:'Confirmación de la obligación de pago en cada adjudicación', buyerRisk:'Controles de riesgo y exposición del comprador de transporte', amendmentsExtras:'Modificaciones y extras aprobados', collectionEvidence:'Pruebas de recogida y entrega', brokerRole:'Papel del broker y obligaciones frente al transportista', carrierCompliance:'Cumplimiento del transportista', subcontracting:'Subcontratación y ejecución posterior' },
  pl: { paymentAck:'Potwierdzenie obowiązku płatności przy każdym przyznaniu zlecenia', buyerRisk:'Kontrole ryzyka i ekspozycji nabywcy transportu', amendmentsExtras:'Aneksy i zatwierdzone dodatkowe opłaty', collectionEvidence:'Dowody odbioru i dostawy', brokerRole:'Rola brokera i obowiązki wobec przewoźnika', carrierCompliance:'Zgodność przewoźnika', subcontracting:'Podwykonawstwo i dalsza realizacja' },
};

export const normalizeLegalLanguage = (value: unknown): LegalLanguage =>
  typeof value === 'string' && (LEGAL_LANGUAGES as readonly string[]).includes(value) ? value as LegalLanguage : 'en';

export const buildControlledLegalDocument = (code: ControlledLegalDocumentCode, language: LegalLanguage): ControlledLegalDocument => {
  const s = shared[language];
  const h = headings[language];
  const version = code === 'privacy_policy' ? CONTROLLED_PRIVACY_VERSION : CONTROLLED_LEGAL_VERSION;
  let sections: ControlledLegalSection[];
  if (code === 'membership_subscription_terms') {
    sections = membershipBody[language].map((body,index)=>({title:`${index + 1}. ${membershipHeadings[language][index]}`,body}));
  } else if (code === 'privacy_policy') {
    sections = privacyBodies[language].map((body,index)=>({title:`${index + 1}. ${privacyHeadings[language][index]}`,body}));
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

    const c = commercialClauses[language];
    const ch = commercialHeadings[language];
    if (code === 'marketplace_transport_terms') {
      sections.push(
        { title: `8. ${ch.paymentAck}`, body: c.paymentAck },
        { title: `9. ${ch.buyerRisk}`, body: c.buyerRisk },
        { title: `10. ${ch.amendmentsExtras}`, body: c.amendmentsExtras },
        { title: `11. ${ch.collectionEvidence}`, body: c.collectionEvidence },
      );
    } else if (code === 'customer_shipper_terms') {
      sections.push(
        { title: `8. ${ch.paymentAck}`, body: c.paymentAck },
        { title: `9. ${ch.buyerRisk}`, body: c.buyerRisk },
      );
    } else if (code === 'broker_terms') {
      sections.push(
        { title: `8. ${ch.brokerRole}`, body: c.brokerRole },
        { title: `9. ${ch.paymentAck}`, body: c.paymentAck },
        { title: `10. ${ch.buyerRisk}`, body: c.buyerRisk },
      );
    } else if (code === 'owner_driver_terms') {
      sections.push(
        { title: `8. ${ch.carrierCompliance}`, body: c.carrierCompliance },
        { title: `9. ${ch.collectionEvidence}`, body: c.collectionEvidence },
        { title: `10. ${ch.amendmentsExtras}`, body: c.amendmentsExtras },
      );
    } else if (code === 'carrier_fleet_terms') {
      sections.push(
        { title: '8. Carrier compliance', body: c.carrierCompliance },
        { title: `9. ${ch.subcontracting}`, body: c.subcontracting },
        { title: `10. ${ch.collectionEvidence}`, body: c.collectionEvidence },
        { title: `11. ${ch.amendmentsExtras}`, body: c.amendmentsExtras },
        { title: `12. ${ch.buyerRisk}`, body: c.buyerRisk },
      );
    }
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

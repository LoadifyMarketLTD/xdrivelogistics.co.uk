import type { LegalLanguage } from './controlledLegalDocuments';

export type LegalUiCopy = {
  backToLegalCentre: string;
  controlledLegalDocument: string;
  version: string;
  translation: string;
  controlledTranslationNotice: string;
  contact: string;
  companyNumber: string;
  registeredOffice: string;
  registeredInEnglandWales: string;
  email: string;
  phone: string;
  read: string;
  readAndAccept: string;
  readPrivacyPolicy: string;
  unsignedDraftNotice: string;
  agreementsHeading: string;
  agreementsDescription: string;
  signerName: string;
  signerPlaceholder: string;
  signerExplanation: string;
  languageLabel: string;
  privacyLinkLabel: string;
  legalControlFooter: string;
};

const COPY: Record<LegalLanguage, LegalUiCopy> = {
  en: {
    backToLegalCentre: 'Back to Legal Centre', controlledLegalDocument: 'Controlled legal document', version: 'Version', translation: 'Translation',
    controlledTranslationNotice: 'This is a controlled translation of the canonical English document. The translation version and exact content hash are recorded when you accept the agreement.',
    contact: 'Contact', companyNumber: 'Company No.', registeredOffice: 'Registered office', registeredInEnglandWales: 'Registered in England and Wales', email: 'Email', phone: 'Phone',
    read: 'Read', readAndAccept: 'I have read and accept', readPrivacyPolicy: 'Read Privacy Policy',
    unsignedDraftNotice: 'Reading a document does not accept it. Your selections are an unsigned draft until you explicitly sign and the server confirms the saved record.',
    agreementsHeading: 'Agreements & declarations', agreementsDescription: 'These confirmations apply to the XDrive role you selected. Nothing is pre-selected.',
    signerName: 'Full legal name of signer', signerPlaceholder: 'Enter your full legal name', signerExplanation: 'Typing your full name and completing the confirmations below forms your electronic signature for this agreement package.',
    languageLabel: 'Legal document language', privacyLinkLabel: 'Read Privacy Policy',
    legalControlFooter: 'Agreement versions are controlled by XDrive and recorded separately from optional marketing consent. Role-specific operational eligibility remains subject to onboarding and compliance checks.',
  },
  ro: {
    backToLegalCentre: 'Înapoi la Centrul Juridic', controlledLegalDocument: 'Document juridic controlat', version: 'Versiune', translation: 'Traducere',
    controlledTranslationNotice: 'Aceasta este traducerea controlată în limba română a documentului canonic în limba engleză. Versiunea traducerii și amprenta exactă a conținutului sunt înregistrate atunci când accepți acordul.',
    contact: 'Contact', companyNumber: 'Nr. companiei', registeredOffice: 'Sediu social', registeredInEnglandWales: 'Înregistrată în Anglia și Țara Galilor', email: 'E-mail', phone: 'Telefon',
    read: 'Citește', readAndAccept: 'Am citit și accept', readPrivacyPolicy: 'Citește Politica de Confidențialitate',
    unsignedDraftNotice: 'Citirea unui document nu înseamnă acceptarea lui. Selecțiile tale rămân o ciornă nesemnată până când semnezi în mod explicit, iar serverul confirmă înregistrarea.',
    agreementsHeading: 'Acorduri și declarații', agreementsDescription: 'Aceste confirmări se aplică rolului XDrive pe care l-ai selectat. Nimic nu este bifat în prealabil.',
    signerName: 'Numele legal complet al semnatarului', signerPlaceholder: 'Introdu numele legal complet', signerExplanation: 'Introducerea numelui legal complet și completarea confirmărilor de mai jos reprezintă semnătura ta electronică pentru acest pachet contractual.',
    languageLabel: 'Limba documentelor juridice', privacyLinkLabel: 'Citește Politica de Confidențialitate',
    legalControlFooter: 'Versiunile acordurilor sunt controlate de XDrive și sunt înregistrate separat de consimțământul opțional pentru marketing. Eligibilitatea operațională specifică rolului rămâne supusă verificărilor de onboarding și conformitate.',
  },
  fr: {
    backToLegalCentre: 'Retour au Centre juridique', controlledLegalDocument: 'Document juridique contrôlé', version: 'Version', translation: 'Traduction',
    controlledTranslationNotice: 'Ceci est une traduction contrôlée du document canonique anglais. La version de traduction et l’empreinte exacte du contenu sont enregistrées lors de votre acceptation.',
    contact: 'Contact', companyNumber: 'N° de société', registeredOffice: 'Siège social', registeredInEnglandWales: 'Enregistrée en Angleterre et au Pays de Galles', email: 'E-mail', phone: 'Téléphone',
    read: 'Lire', readAndAccept: 'J’ai lu et j’accepte', readPrivacyPolicy: 'Lire la Politique de confidentialité',
    unsignedDraftNotice: 'La lecture d’un document ne vaut pas acceptation. Vos sélections restent un brouillon non signé jusqu’à votre signature explicite et la confirmation du serveur.',
    agreementsHeading: 'Accords et déclarations', agreementsDescription: 'Ces confirmations s’appliquent au rôle XDrive sélectionné. Rien n’est présélectionné.',
    signerName: 'Nom légal complet du signataire', signerPlaceholder: 'Saisissez votre nom légal complet', signerExplanation: 'La saisie de votre nom complet et la validation des confirmations ci-dessous constituent votre signature électronique pour ce dossier contractuel.',
    languageLabel: 'Langue des documents juridiques', privacyLinkLabel: 'Lire la Politique de confidentialité',
    legalControlFooter: 'Les versions des accords sont contrôlées par XDrive et enregistrées séparément du consentement marketing facultatif. L’éligibilité opérationnelle propre au rôle reste soumise aux contrôles d’onboarding et de conformité.',
  },
  es: {
    backToLegalCentre: 'Volver al Centro legal', controlledLegalDocument: 'Documento legal controlado', version: 'Versión', translation: 'Traducción',
    controlledTranslationNotice: 'Esta es una traducción controlada del documento canónico en inglés. La versión de la traducción y la huella exacta del contenido se registran al aceptar el acuerdo.',
    contact: 'Contacto', companyNumber: 'N.º de empresa', registeredOffice: 'Domicilio social', registeredInEnglandWales: 'Registrada en Inglaterra y Gales', email: 'Correo electrónico', phone: 'Teléfono',
    read: 'Leer', readAndAccept: 'He leído y acepto', readPrivacyPolicy: 'Leer la Política de privacidad',
    unsignedDraftNotice: 'Leer un documento no implica aceptarlo. Tus selecciones son un borrador sin firmar hasta que firmes expresamente y el servidor confirme el registro.',
    agreementsHeading: 'Acuerdos y declaraciones', agreementsDescription: 'Estas confirmaciones se aplican al rol de XDrive seleccionado. Nada está preseleccionado.',
    signerName: 'Nombre legal completo del firmante', signerPlaceholder: 'Introduce tu nombre legal completo', signerExplanation: 'Escribir tu nombre legal completo y completar las confirmaciones siguientes constituye tu firma electrónica para este paquete contractual.',
    languageLabel: 'Idioma de los documentos legales', privacyLinkLabel: 'Leer la Política de privacidad',
    legalControlFooter: 'Las versiones de los acuerdos están controladas por XDrive y se registran por separado del consentimiento opcional de marketing. La elegibilidad operativa específica del rol sigue sujeta a controles de onboarding y cumplimiento.',
  },
  pl: {
    backToLegalCentre: 'Powrót do Centrum prawnego', controlledLegalDocument: 'Kontrolowany dokument prawny', version: 'Wersja', translation: 'Tłumaczenie',
    controlledTranslationNotice: 'To kontrolowane tłumaczenie kanonicznego dokumentu angielskiego. Wersja tłumaczenia i dokładny skrót treści są zapisywane przy akceptacji umowy.',
    contact: 'Kontakt', companyNumber: 'Nr spółki', registeredOffice: 'Siedziba rejestrowa', registeredInEnglandWales: 'Zarejestrowana w Anglii i Walii', email: 'E-mail', phone: 'Telefon',
    read: 'Przeczytaj', readAndAccept: 'Przeczytałem(-am) i akceptuję', readPrivacyPolicy: 'Przeczytaj Politykę prywatności',
    unsignedDraftNotice: 'Samo przeczytanie dokumentu nie oznacza akceptacji. Twoje wybory pozostają niepodpisanym szkicem do czasu wyraźnego podpisania i potwierdzenia zapisu przez serwer.',
    agreementsHeading: 'Umowy i oświadczenia', agreementsDescription: 'Te potwierdzenia dotyczą wybranej roli XDrive. Nic nie jest zaznaczone domyślnie.',
    signerName: 'Pełne imię i nazwisko prawne podpisującego', signerPlaceholder: 'Wpisz pełne imię i nazwisko prawne', signerExplanation: 'Wpisanie pełnego imienia i nazwiska oraz potwierdzenie poniższych oświadczeń stanowi podpis elektroniczny tego pakietu umownego.',
    languageLabel: 'Język dokumentów prawnych', privacyLinkLabel: 'Przeczytaj Politykę prywatności',
    legalControlFooter: 'Wersje umów są kontrolowane przez XDrive i zapisywane oddzielnie od opcjonalnej zgody marketingowej. Uprawnienia operacyjne właściwe dla roli nadal podlegają onboardingowi i kontrolom zgodności.',
  },
};

export const getLegalUiCopy = (language: LegalLanguage): LegalUiCopy => COPY[language];

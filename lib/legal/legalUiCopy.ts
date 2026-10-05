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
  languageComprehensionConfirmation: string;
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
    languageLabel: 'Legal document language', languageComprehensionConfirmation: 'I confirm that I can read and understand the selected legal document language. I have read the complete agreements presented in this language before signing.', privacyLinkLabel: 'Read Privacy Policy',
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
    languageLabel: 'Limba documentelor juridice', languageComprehensionConfirmation: 'Confirm că pot citi și înțelege limba selectată pentru documentele juridice. Am citit integral acordurile prezentate în această limbă înainte de a semna.', privacyLinkLabel: 'Citește Politica de Confidențialitate',
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
    languageLabel: 'Langue des documents juridiques', languageComprehensionConfirmation: 'Je confirme que je peux lire et comprendre la langue sélectionnée pour les documents juridiques. J’ai lu intégralement les accords présentés dans cette langue avant de signer.', privacyLinkLabel: 'Lire la Politique de confidentialité',
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
    languageLabel: 'Idioma de los documentos legales', languageComprehensionConfirmation: 'Confirmo que puedo leer y comprender el idioma seleccionado para los documentos legales. He leído íntegramente los acuerdos presentados en este idioma antes de firmar.', privacyLinkLabel: 'Leer la Política de privacidad',
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
    languageLabel: 'Język dokumentów prawnych', languageComprehensionConfirmation: 'Potwierdzam, że potrafię czytać i rozumiem wybrany język dokumentów prawnych. Przed podpisaniem przeczytałem(-am) w całości umowy przedstawione w tym języku.', privacyLinkLabel: 'Przeczytaj Politykę prywatności',
    legalControlFooter: 'Wersje umów są kontrolowane przez XDrive i zapisywane oddzielnie od opcjonalnej zgody marketingowej. Uprawnienia operacyjne właściwe dla roli nadal podlegają onboardingowi i kontrolom zgodności.',
  },

  ur: {
    backToLegalCentre:'قانونی مرکز پر واپس', controlledLegalDocument:'کنٹرول شدہ قانونی دستاویز', version:'ورژن', translation:'ترجمہ',
    controlledTranslationNotice:'یہ canonical English document کا کنٹرول شدہ ترجمہ ہے۔ قبول کرتے وقت ترجمے کا ورژن اور مواد کا درست hash ریکارڈ کیا جاتا ہے۔',
    contact:'رابطہ', companyNumber:'کمپنی نمبر', registeredOffice:'رجسٹرڈ دفتر', registeredInEnglandWales:'انگلینڈ اور ویلز میں رجسٹرڈ', email:'ای میل', phone:'فون',
    read:'پڑھیں', readAndAccept:'میں نے پڑھا اور قبول کیا', readPrivacyPolicy:'Privacy Policy پڑھیں',
    unsignedDraftNotice:'صرف دستاویز پڑھنا قبولیت نہیں ہے۔ آپ کے انتخاب اس وقت تک غیر دستخط شدہ draft رہتے ہیں جب تک آپ واضح طور پر دستخط نہ کریں اور server محفوظ شدہ record کی تصدیق نہ کرے۔',
    agreementsHeading:'معاہدے اور اعلانات', agreementsDescription:'یہ تصدیقات آپ کے منتخب XDrive کردار پر لاگو ہوتی ہیں۔ کچھ بھی پہلے سے منتخب نہیں ہے۔',
    signerName:'دستخط کنندہ کا مکمل قانونی نام', signerPlaceholder:'اپنا مکمل قانونی نام درج کریں', signerExplanation:'اپنا مکمل قانونی نام درج کرنا اور نیچے دی گئی تصدیقات مکمل کرنا اس agreement package کے لیے آپ کا electronic signature بناتا ہے۔',
    languageLabel:'قانونی دستاویز کی زبان', languageComprehensionConfirmation:'میں تصدیق کرتا/کرتی ہوں کہ میں منتخب قانونی دستاویز کی زبان پڑھ اور سمجھ سکتا/سکتی ہوں۔ دستخط کرنے سے پہلے میں نے اس زبان میں پیش کیے گئے مکمل معاہدے پڑھے ہیں۔', privacyLinkLabel:'Privacy Policy پڑھیں',
    legalControlFooter:'Agreement versions XDrive کے زیرِ کنٹرول ہیں اور optional marketing consent سے الگ ریکارڈ کیے جاتے ہیں۔ Role-specific operational eligibility onboarding اور compliance checks کے تابع رہتی ہے۔',
  },
  'pa-guru': {
    backToLegalCentre:'ਕਾਨੂੰਨੀ ਕੇਂਦਰ ਵਾਪਸ', controlledLegalDocument:'ਨਿਯੰਤਰਿਤ ਕਾਨੂੰਨੀ ਦਸਤਾਵੇਜ਼', version:'ਵਰਜਨ', translation:'ਅਨੁਵਾਦ',
    controlledTranslationNotice:'ਇਹ canonical English document ਦਾ ਨਿਯੰਤਰਿਤ ਅਨੁਵਾਦ ਹੈ। Agreement accept ਕਰਨ ਵੇਲੇ translation version ਅਤੇ exact content hash record ਹੁੰਦੇ ਹਨ।',
    contact:'ਸੰਪਰਕ', companyNumber:'ਕੰਪਨੀ ਨੰਬਰ', registeredOffice:'ਰਜਿਸਟਰਡ ਦਫ਼ਤਰ', registeredInEnglandWales:'England and Wales ਵਿੱਚ registered', email:'ਈਮੇਲ', phone:'ਫੋਨ',
    read:'ਪੜ੍ਹੋ', readAndAccept:'ਮੈਂ ਪੜ੍ਹ ਲਿਆ ਅਤੇ ਸਵੀਕਾਰ ਕਰਦਾ/ਕਰਦੀ ਹਾਂ', readPrivacyPolicy:'Privacy Policy ਪੜ੍ਹੋ',
    unsignedDraftNotice:'ਸਿਰਫ਼ document ਪੜ੍ਹਨਾ acceptance ਨਹੀਂ ਹੈ। ਤੁਹਾਡੀਆਂ selections unsigned draft ਰਹਿੰਦੀਆਂ ਹਨ ਜਦ ਤੱਕ ਤੁਸੀਂ explicitly sign ਨਾ ਕਰੋ ਅਤੇ server saved record confirm ਨਾ ਕਰੇ।',
    agreementsHeading:'Agreements ਅਤੇ declarations', agreementsDescription:'ਇਹ confirmations ਤੁਹਾਡੇ ਚੁਣੇ XDrive role ਲਈ ਹਨ। ਕੁਝ ਵੀ ਪਹਿਲਾਂ ਤੋਂ selected ਨਹੀਂ ਹੈ।',
    signerName:'Signer ਦਾ ਪੂਰਾ ਕਾਨੂੰਨੀ ਨਾਮ', signerPlaceholder:'ਆਪਣਾ ਪੂਰਾ ਕਾਨੂੰਨੀ ਨਾਮ ਲਿਖੋ', signerExplanation:'ਪੂਰਾ ਕਾਨੂੰਨੀ ਨਾਮ ਲਿਖਣਾ ਅਤੇ ਹੇਠਾਂ ਦਿੱਤੀਆਂ confirmations ਪੂਰੀਆਂ ਕਰਨਾ ਇਸ agreement package ਲਈ ਤੁਹਾਡਾ electronic signature ਹੈ।',
    languageLabel:'ਕਾਨੂੰਨੀ ਦਸਤਾਵੇਜ਼ ਦੀ ਭਾਸ਼ਾ', languageComprehensionConfirmation:'ਮੈਂ ਪੁਸ਼ਟੀ ਕਰਦਾ/ਕਰਦੀ ਹਾਂ ਕਿ ਮੈਂ ਚੁਣੀ ਕਾਨੂੰਨੀ ਦਸਤਾਵੇਜ਼ ਦੀ ਭਾਸ਼ਾ ਪੜ੍ਹ ਅਤੇ ਸਮਝ ਸਕਦਾ/ਸਕਦੀ ਹਾਂ। Sign ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਮੈਂ ਇਸ ਭਾਸ਼ਾ ਵਿੱਚ ਦਿੱਤੇ ਪੂਰੇ agreements ਪੜ੍ਹੇ ਹਨ।', privacyLinkLabel:'Privacy Policy ਪੜ੍ਹੋ',
    legalControlFooter:'Agreement versions XDrive ਦੁਆਰਾ controlled ਹਨ ਅਤੇ optional marketing consent ਤੋਂ ਵੱਖ record ਹੁੰਦੇ ਹਨ। Role-specific operational eligibility onboarding ਅਤੇ compliance checks ਦੇ ਅਧੀਨ ਰਹਿੰਦੀ ਹੈ।',
  },
  'pa-shah': {
    backToLegalCentre:'قانونی مرکز ول واپس', controlledLegalDocument:'کنٹرول شدہ قانونی دستاویز', version:'ورژن', translation:'ترجمہ',
    controlledTranslationNotice:'ایہ canonical English document دا کنٹرول شدہ ترجمہ اے۔ Agreement accept کرن ویلے translation version تے exact content hash record ہوندے نیں۔',
    contact:'رابطہ', companyNumber:'کمپنی نمبر', registeredOffice:'رجسٹرڈ دفتر', registeredInEnglandWales:'England and Wales وچ registered', email:'ای میل', phone:'فون',
    read:'پڑھو', readAndAccept:'میں پڑھ لیا تے قبول کردا/کردی آں', readPrivacyPolicy:'Privacy Policy پڑھو',
    unsignedDraftNotice:'صرف document پڑھنا acceptance نئیں اے۔ تہاڈیاں selections unsigned draft رہندیاں نیں جد تک تسی explicitly sign نہ کرو تے server saved record confirm نہ کرے۔',
    agreementsHeading:'Agreements تے declarations', agreementsDescription:'ایہ confirmations تہاڈے چنے XDrive role تے لاگو ہوندیاں نیں۔ کچھ وی پہلے توں selected نئیں اے۔',
    signerName:'Signer دا پورا قانونی ناں', signerPlaceholder:'اپنا پورا قانونی ناں لکھو', signerExplanation:'پورا قانونی ناں لکھنا تے ہيٹھاں دتیاں confirmations مکمل کرنا اس agreement package لئی تہاڈا electronic signature اے۔',
    languageLabel:'قانونی دستاویز دی زبان', languageComprehensionConfirmation:'میں تصدیق کردا/کردی آں کہ میں چنی قانونی دستاویز دی زبان پڑھ تے سمجھ سکدا/سکدی آں۔ Sign کرن توں پہلاں میں اس زبان وچ پیش کیتے مکمل agreements پڑھے نیں۔', privacyLinkLabel:'Privacy Policy پڑھو',
    legalControlFooter:'Agreement versions XDrive دے control وچ نیں تے optional marketing consent توں وکھ record ہوندے نیں۔ Role-specific operational eligibility onboarding تے compliance checks دے تابع رہندی اے۔',
  },
  hi: {
    backToLegalCentre:'कानूनी केंद्र पर वापस', controlledLegalDocument:'नियंत्रित कानूनी दस्तावेज़', version:'संस्करण', translation:'अनुवाद',
    controlledTranslationNotice:'यह canonical English document का नियंत्रित अनुवाद है। Agreement स्वीकार करते समय translation version और exact content hash दर्ज किए जाते हैं।',
    contact:'संपर्क', companyNumber:'कंपनी नंबर', registeredOffice:'पंजीकृत कार्यालय', registeredInEnglandWales:'England and Wales में पंजीकृत', email:'ईमेल', phone:'फ़ोन',
    read:'पढ़ें', readAndAccept:'मैंने पढ़ा और स्वीकार किया', readPrivacyPolicy:'Privacy Policy पढ़ें',
    unsignedDraftNotice:'केवल document पढ़ना acceptance नहीं है। आपकी selections तब तक unsigned draft रहती हैं जब तक आप स्पष्ट रूप से sign न करें और server saved record की पुष्टि न करे।',
    agreementsHeading:'Agreements और declarations', agreementsDescription:'ये confirmations आपके चुने XDrive role पर लागू हैं। कुछ भी पहले से selected नहीं है।',
    signerName:'Signer का पूरा कानूनी नाम', signerPlaceholder:'अपना पूरा कानूनी नाम दर्ज करें', signerExplanation:'पूरा कानूनी नाम दर्ज करना और नीचे की confirmations पूरी करना इस agreement package के लिए आपका electronic signature बनाता है।',
    languageLabel:'कानूनी दस्तावेज़ की भाषा', languageComprehensionConfirmation:'मैं पुष्टि करता/करती हूँ कि मैं चुनी गई कानूनी दस्तावेज़ की भाषा पढ़ और समझ सकता/सकती हूँ। Sign करने से पहले मैंने इस भाषा में प्रस्तुत पूरे agreements पढ़े हैं।', privacyLinkLabel:'Privacy Policy पढ़ें',
    legalControlFooter:'Agreement versions XDrive द्वारा controlled हैं और optional marketing consent से अलग record किए जाते हैं। Role-specific operational eligibility onboarding और compliance checks के अधीन रहती है।',
  },
  bn: {
    backToLegalCentre:'আইনি কেন্দ্রে ফিরে যান', controlledLegalDocument:'নিয়ন্ত্রিত আইনি নথি', version:'সংস্করণ', translation:'অনুবাদ',
    controlledTranslationNotice:'এটি canonical English document-এর নিয়ন্ত্রিত অনুবাদ। Agreement গ্রহণের সময় translation version এবং exact content hash record করা হয়।',
    contact:'যোগাযোগ', companyNumber:'কোম্পানি নম্বর', registeredOffice:'নিবন্ধিত অফিস', registeredInEnglandWales:'England and Wales-এ নিবন্ধিত', email:'ইমেইল', phone:'ফোন',
    read:'পড়ুন', readAndAccept:'আমি পড়েছি এবং গ্রহণ করছি', readPrivacyPolicy:'Privacy Policy পড়ুন',
    unsignedDraftNotice:'শুধু document পড়া acceptance নয়। আপনি স্পষ্টভাবে sign না করা এবং server saved record confirm না করা পর্যন্ত selections unsigned draft থাকে।',
    agreementsHeading:'Agreements ও declarations', agreementsDescription:'এই confirmations আপনার নির্বাচিত XDrive role-এর জন্য প্রযোজ্য। কিছুই আগে থেকে selected নয়।',
    signerName:'Signer-এর পূর্ণ আইনি নাম', signerPlaceholder:'আপনার পূর্ণ আইনি নাম লিখুন', signerExplanation:'পূর্ণ আইনি নাম লেখা এবং নিচের confirmations সম্পন্ন করা এই agreement package-এর জন্য আপনার electronic signature তৈরি করে।',
    languageLabel:'আইনি নথির ভাষা', languageComprehensionConfirmation:'আমি নিশ্চিত করছি যে নির্বাচিত আইনি নথির ভাষা আমি পড়তে ও বুঝতে পারি। Sign করার আগে এই ভাষায় উপস্থাপিত সম্পূর্ণ agreements আমি পড়েছি।', privacyLinkLabel:'Privacy Policy পড়ুন',
    legalControlFooter:'Agreement versions XDrive দ্বারা controlled এবং optional marketing consent থেকে আলাদাভাবে record করা হয়। Role-specific operational eligibility onboarding ও compliance checks-এর অধীন থাকে।',
  },
  gu: {
    backToLegalCentre:'કાનૂની કેન્દ્ર પર પાછા', controlledLegalDocument:'નિયંત્રિત કાનૂની દસ્તાવેજ', version:'આવૃત્તિ', translation:'અનુવાદ',
    controlledTranslationNotice:'આ canonical English document નો નિયંત્રિત અનુવાદ છે. Agreement સ્વીકારતી વખતે translation version અને exact content hash record થાય છે.',
    contact:'સંપર્ક', companyNumber:'કંપની નંબર', registeredOffice:'રજિસ્ટર્ડ ઓફિસ', registeredInEnglandWales:'England and Wales માં registered', email:'ઈમેલ', phone:'ફોન',
    read:'વાંચો', readAndAccept:'મેં વાંચ્યું અને સ્વીકારું છું', readPrivacyPolicy:'Privacy Policy વાંચો',
    unsignedDraftNotice:'માત્ર document વાંચવું acceptance નથી. તમે explicitly sign ન કરો અને server saved record confirm ન કરે ત્યાં સુધી selections unsigned draft રહે છે.',
    agreementsHeading:'Agreements અને declarations', agreementsDescription:'આ confirmations તમારા પસંદ કરેલા XDrive role માટે લાગુ પડે છે. કશું પણ પહેલેથી selected નથી.',
    signerName:'Signer નું પૂરું કાનૂની નામ', signerPlaceholder:'તમારું પૂરું કાનૂની નામ દાખલ કરો', signerExplanation:'પૂરું કાનૂની નામ દાખલ કરવું અને નીચેની confirmations પૂર્ણ કરવી આ agreement package માટે તમારું electronic signature બનાવે છે.',
    languageLabel:'કાનૂની દસ્તાવેજની ભાષા', languageComprehensionConfirmation:'હું પુષ્ટિ કરું છું કે હું પસંદ કરેલી કાનૂની દસ્તાવેજની ભાષા વાંચી અને સમજી શકું છું. Sign કરતા પહેલાં મેં આ ભાષામાં રજૂ થયેલા સંપૂર્ણ agreements વાંચ્યા છે.', privacyLinkLabel:'Privacy Policy વાંચો',
    legalControlFooter:'Agreement versions XDrive દ્વારા controlled છે અને optional marketing consent થી અલગ record થાય છે. Role-specific operational eligibility onboarding અને compliance checks હેઠળ રહે છે.',
  },
};

export const getLegalUiCopy = (language: LegalLanguage): LegalUiCopy => COPY[language];

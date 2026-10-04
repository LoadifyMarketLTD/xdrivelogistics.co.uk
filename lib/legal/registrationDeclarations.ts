import type { LegalLanguage } from './controlledLegalDocuments';
import type { RegistrationLegalRole } from './registrationAgreements';

type LocalizedDeclarations = {
  authority: string;
  privacy: string;
  roles: Record<RegistrationLegalRole,string>;
};

const DECLARATIONS: Record<Exclude<LegalLanguage,'en'>,LocalizedDeclarations> = {
  ro: {
    authority: 'Confirm că sunt autorizat(ă) să creez și să folosesc acest cont XDrive în numele afacerii sau organizației pe care o reprezint.',
    privacy: 'Confirm că XDrive va prelucra informațiile mele conform Politicii de Confidențialitate.',
    roles: {
      customer_shipper: 'Confirm că cerințele de transport și informațiile despre mărfuri pe care le trimit prin XDrive vor fi corecte și legale.',
      transport_broker: 'Confirm că sunt autorizat(ă) să gestionez cerințe de transport pentru clienții sau companiile pe care le reprezint și că informațiile furnizate vor fi corecte.',
      owner_operator: 'Înțeleg că eligibilitatea de a executa transporturi prin XDrive depinde de verificarea identității, vehiculului, asigurării și conformității.',
      fleet_operator: 'Confirm că transportatorul este responsabil pentru șoferii, vehiculele, asigurările și informațiile de conformitate furnizate către XDrive.',
    },
  },
  fr: {
    authority: 'Je confirme être autorisé(e) à créer et utiliser ce compte XDrive pour l’entreprise ou l’organisation que je représente.',
    privacy: 'Je reconnais que XDrive traitera mes informations conformément à la Politique de confidentialité.',
    roles: {
      customer_shipper: 'Je confirme que les exigences de transport et les informations sur les marchandises soumises via XDrive seront exactes et licites.',
      transport_broker: 'Je confirme être autorisé(e) à gérer des exigences de transport pour les clients ou entreprises que je représente et que les informations fournies seront exactes.',
      owner_operator: 'Je comprends que l’éligibilité à effectuer des transports via XDrive dépend de la vérification de l’identité, du véhicule, de l’assurance et de la conformité.',
      fleet_operator: 'Je confirme que le transporteur est responsable des chauffeurs, véhicules, assurances et informations de conformité qu’il fournit à XDrive.',
    },
  },
  es: {
    authority: 'Confirmo que estoy autorizado/a para crear y utilizar esta cuenta XDrive para la empresa u organización que represento.',
    privacy: 'Reconozco que XDrive tratará mi información conforme a la Política de privacidad.',
    roles: {
      customer_shipper: 'Confirmo que los requisitos de transporte y la información de las mercancías que envíe mediante XDrive serán exactos y lícitos.',
      transport_broker: 'Confirmo que estoy autorizado/a para gestionar requisitos de transporte para los clientes o empresas que represento y que la información facilitada será exacta.',
      owner_operator: 'Entiendo que la elegibilidad para realizar transportes mediante XDrive está sujeta a la verificación de identidad, vehículo, seguro y cumplimiento.',
      fleet_operator: 'Confirmo que el transportista es responsable de los conductores, vehículos, seguros e información de cumplimiento que proporciona a XDrive.',
    },
  },
  pl: {
    authority: 'Potwierdzam, że jestem upoważniony(-a) do utworzenia i używania tego konta XDrive w imieniu firmy lub organizacji, którą reprezentuję.',
    privacy: 'Przyjmuję do wiadomości, że XDrive będzie przetwarzać moje informacje zgodnie z Polityką prywatności.',
    roles: {
      customer_shipper: 'Potwierdzam, że wymagania transportowe i informacje o towarach przesyłane przeze mnie przez XDrive będą prawidłowe i zgodne z prawem.',
      transport_broker: 'Potwierdzam, że jestem upoważniony(-a) do zarządzania wymaganiami transportowymi klientów lub firm, które reprezentuję, a podawane informacje będą prawidłowe.',
      owner_operator: 'Rozumiem, że możliwość wykonywania transportów przez XDrive zależy od weryfikacji tożsamości, pojazdu, ubezpieczenia i zgodności.',
      fleet_operator: 'Potwierdzam, że przewoźnik odpowiada za kierowców, pojazdy, ubezpieczenia i informacje dotyczące zgodności przekazywane XDrive.',
    },
  },
  ur: {
    authority:'میں تصدیق کرتا/کرتی ہوں کہ میں اس کاروبار یا تنظیم کی طرف سے یہ XDrive اکاؤنٹ بنانے اور استعمال کرنے کا مجاز/مجازہ ہوں جس کی میں نمائندگی کرتا/کرتی ہوں۔',
    privacy:'میں تسلیم کرتا/کرتی ہوں کہ XDrive میری معلومات Privacy Policy کے مطابق پراسیس کرے گا۔',
    roles:{
      customer_shipper:'میں تصدیق کرتا/کرتی ہوں کہ XDrive کے ذریعے دی گئی ٹرانسپورٹ ضروریات اور سامان کی معلومات درست اور قانونی ہوں گی۔',
      transport_broker:'میں تصدیق کرتا/کرتی ہوں کہ میں اپنے نمائندہ کسٹمرز یا کمپنیوں کے لیے ٹرانسپورٹ ضروریات منظم کرنے کا مجاز/مجازہ ہوں اور فراہم کردہ معلومات درست ہوں گی۔',
      owner_operator:'میں سمجھتا/سمجھتی ہوں کہ XDrive کے ذریعے ٹرانسپورٹ کام انجام دینے کی اہلیت شناخت، گاڑی، انشورنس اور compliance کی verification پر منحصر ہے۔',
      fleet_operator:'میں تصدیق کرتا/کرتی ہوں کہ کیریئر اپنے drivers، vehicles، insurance اور XDrive کو دی گئی compliance information کا ذمہ دار ہے۔',
    },
  },
  'pa-guru': {
    authority:'ਮੈਂ ਪੁਸ਼ਟੀ ਕਰਦਾ/ਕਰਦੀ ਹਾਂ ਕਿ ਜਿਸ ਕਾਰੋਬਾਰ ਜਾਂ ਸੰਗਠਨ ਦੀ ਮੈਂ ਨੁਮਾਇੰਦਗੀ ਕਰਦਾ/ਕਰਦੀ ਹਾਂ ਉਸ ਦੀ ਓਰੋਂ ਇਹ XDrive account ਬਣਾਉਣ ਅਤੇ ਵਰਤਣ ਲਈ ਮੈਂ authorised ਹਾਂ।',
    privacy:'ਮੈਂ ਮੰਨਦਾ/ਮੰਨਦੀ ਹਾਂ ਕਿ XDrive ਮੇਰੀ ਜਾਣਕਾਰੀ ਨੂੰ Privacy Policy ਅਨੁਸਾਰ process ਕਰੇਗਾ।',
    roles:{
      customer_shipper:'ਮੈਂ ਪੁਸ਼ਟੀ ਕਰਦਾ/ਕਰਦੀ ਹਾਂ ਕਿ XDrive ਰਾਹੀਂ ਦਿੱਤੀਆਂ transport requirements ਅਤੇ goods information accurate ਅਤੇ lawful ਹੋਣਗੀਆਂ।',
      transport_broker:'ਮੈਂ ਪੁਸ਼ਟੀ ਕਰਦਾ/ਕਰਦੀ ਹਾਂ ਕਿ ਆਪਣੇ represented customers ਜਾਂ companies ਲਈ transport requirements manage ਕਰਨ ਲਈ authorised ਹਾਂ ਅਤੇ ਦਿੱਤੀ ਜਾਣਕਾਰੀ accurate ਹੋਵੇਗੀ।',
      owner_operator:'ਮੈਂ ਸਮਝਦਾ/ਸਮਝਦੀ ਹਾਂ ਕਿ XDrive ਰਾਹੀਂ transport work ਕਰਨ ਦੀ eligibility identity, vehicle, insurance ਅਤੇ compliance verification ਦੇ ਅਧੀਨ ਹੈ।',
      fleet_operator:'ਮੈਂ ਪੁਸ਼ਟੀ ਕਰਦਾ/ਕਰਦੀ ਹਾਂ ਕਿ carrier ਆਪਣੇ drivers, vehicles, insurance ਅਤੇ XDrive ਨੂੰ ਦਿੱਤੀ compliance information ਲਈ responsible ਹੈ।',
    },
  },
  'pa-shah': {
    authority:'میں تصدیق کردا/کردی آں کہ جس کاروبار یا تنظیم دی میں نمائندگی کردا/کردی آں اوہدے ولوں ایہ XDrive account بنانے تے ورتن لئی authorised آں۔',
    privacy:'میں مندا/مندی آں کہ XDrive میری information نوں Privacy Policy مطابق process کرے گا۔',
    roles:{
      customer_shipper:'میں تصدیق کردا/کردی آں کہ XDrive راہیں دتیاں transport requirements تے goods information accurate تے lawful ہون گیاں۔',
      transport_broker:'میں تصدیق کردا/کردی آں کہ اپنے represented customers یا companies لئی transport requirements manage کرن لئی authorised آں تے دتی information accurate ہووے گی۔',
      owner_operator:'میں سمجھدا/سمجھدی آں کہ XDrive راہیں transport work کرن دی eligibility identity، vehicle، insurance تے compliance verification دے تابع اے۔',
      fleet_operator:'میں تصدیق کردا/کردی آں کہ carrier اپنے drivers، vehicles، insurance تے XDrive نوں دتی compliance information دا responsible اے۔',
    },
  },
  hi: {
    authority:'मैं पुष्टि करता/करती हूँ कि जिस व्यवसाय या संगठन का मैं प्रतिनिधित्व करता/करती हूँ उसकी ओर से यह XDrive account बनाने और उपयोग करने के लिए अधिकृत हूँ।',
    privacy:'मैं स्वीकार करता/करती हूँ कि XDrive मेरी जानकारी को Privacy Policy के अनुसार process करेगा।',
    roles:{
      customer_shipper:'मैं पुष्टि करता/करती हूँ कि XDrive के माध्यम से दी गई transport requirements और goods information accurate और lawful होगी।',
      transport_broker:'मैं पुष्टि करता/करती हूँ कि अपने प्रतिनिधित्व वाले customers या companies के लिए transport requirements manage करने के लिए अधिकृत हूँ और दी गई information accurate होगी।',
      owner_operator:'मैं समझता/समझती हूँ कि XDrive के माध्यम से transport work करने की eligibility identity, vehicle, insurance और compliance verification पर निर्भर है।',
      fleet_operator:'मैं पुष्टि करता/करती हूँ कि carrier अपने drivers, vehicles, insurance और XDrive को दी गई compliance information के लिए responsible है।',
    },
  },
  bn: {
    authority:'আমি নিশ্চিত করছি যে আমি যে ব্যবসা বা প্রতিষ্ঠানের প্রতিনিধিত্ব করি তার পক্ষে এই XDrive account তৈরি ও ব্যবহার করার জন্য অনুমোদিত।',
    privacy:'আমি স্বীকার করছি যে XDrive আমার তথ্য Privacy Policy অনুযায়ী process করবে।',
    roles:{
      customer_shipper:'আমি নিশ্চিত করছি যে XDrive-এর মাধ্যমে দেওয়া transport requirements এবং goods information accurate ও lawful হবে।',
      transport_broker:'আমি নিশ্চিত করছি যে প্রতিনিধিত্ব করা customers বা companies-এর transport requirements manage করার জন্য আমি অনুমোদিত এবং দেওয়া information accurate হবে।',
      owner_operator:'আমি বুঝি যে XDrive-এর মাধ্যমে transport work করার eligibility identity, vehicle, insurance এবং compliance verification-এর উপর নির্ভর করে।',
      fleet_operator:'আমি নিশ্চিত করছি যে carrier তার drivers, vehicles, insurance এবং XDrive-কে দেওয়া compliance information-এর জন্য responsible।',
    },
  },
  gu: {
    authority:'હું પુષ્ટિ કરું છું કે હું જે વ્યવસાય અથવા સંસ્થાનું પ્રતિનિધિત્વ કરું છું તેની તરફથી આ XDrive account બનાવવા અને ઉપયોગ કરવા માટે authorised છું.',
    privacy:'હું સ્વીકારું છું કે XDrive મારી માહિતી Privacy Policy અનુસાર process કરશે.',
    roles:{
      customer_shipper:'હું પુષ્ટિ કરું છું કે XDrive દ્વારા આપેલી transport requirements અને goods information accurate અને lawful હશે.',
      transport_broker:'હું પુષ્ટિ કરું છું કે હું પ્રતિનિધિત્વ કરેલા customers અથવા companies માટે transport requirements manage કરવા authorised છું અને આપેલી information accurate હશે.',
      owner_operator:'હું સમજું છું કે XDrive દ્વારા transport work કરવાની eligibility identity, vehicle, insurance અને compliance verification પર આધારિત છે.',
      fleet_operator:'હું પુષ્ટિ કરું છું કે carrier પોતાના drivers, vehicles, insurance અને XDrive ને આપેલી compliance information માટે responsible છે.',
    },
  },

};

const TRANSPORT_CONTROL_NOTICE: Record<LegalLanguage,string> = {
  en: 'Commercial accounts must complete XDrive Stripe onboarding and remain commercially ready before they can publish, quote for, award or accept transport work. When this account acts as transport buyer, XDrive may apply risk limits at Publish and Award. New buyers are currently restricted by default to up to 3 active transport commitments and £2,500 outstanding transport exposure unless reviewed by an authorised Platform Owner. At each Award, the buyer must separately confirm its payment obligation; that obligation is not conditional on the buyer, broker or ordering party first being paid by its own customer or another third party. The selected carrier must then explicitly accept the final booking before the transport agreement is formed.',
  ro: 'Conturile comerciale trebuie să finalizeze onboardingul Stripe XDrive și să rămână pregătite comercial înainte de a putea publica, cota, atribui sau accepta transporturi. Atunci când acest cont acționează ca transport buyer, XDrive poate aplica limite de risc la Publish și Award. Buyerii noi sunt limitați implicit la maximum 3 angajamente active de transport și £2,500 expunere restantă pentru transport, dacă un Platform Owner autorizat nu revizuiește aceste limite. La fiecare Award, buyer-ul trebuie să confirme separat obligația de plată; această obligație nu depinde de faptul că buyer-ul, brokerul sau partea care comandă transportul a fost mai întâi plătită de propriul client ori de un alt terț. Transportatorul selectat trebuie apoi să accepte explicit rezervarea finală înainte de formarea acordului de transport.',
  fr: 'Les comptes commerciaux doivent terminer l’onboarding Stripe XDrive et rester commercialement opérationnels avant de pouvoir publier, proposer un devis, attribuer ou accepter un transport. Lorsque ce compte agit comme acheteur de transport, XDrive peut appliquer des limites de risque lors de la publication et de l’attribution. Les nouveaux acheteurs sont limités par défaut à 3 engagements de transport actifs et à £2,500 d’exposition de transport impayée, sauf révision par un Platform Owner autorisé. À chaque attribution, l’acheteur doit confirmer séparément son obligation de paiement; cette obligation ne dépend pas du fait que l’acheteur, le courtier ou le donneur d’ordre ait d’abord été payé par son propre client ou un autre tiers. Le transporteur sélectionné doit ensuite accepter explicitement la réservation finale avant la formation du contrat de transport.',
  es: 'Las cuentas comerciales deben completar el onboarding de Stripe de XDrive y mantenerse comercialmente operativas antes de poder publicar, cotizar, adjudicar o aceptar trabajos de transporte. Cuando esta cuenta actúa como comprador de transporte, XDrive puede aplicar límites de riesgo en Publish y Award. Los compradores nuevos están limitados por defecto a un máximo de 3 compromisos de transporte activos y £2,500 de exposición de transporte pendiente, salvo revisión por un Platform Owner autorizado. En cada Award, el comprador debe confirmar por separado su obligación de pago; esta obligación no depende de que el comprador, broker o parte contratante haya recibido primero el pago de su propio cliente o de cualquier otro tercero. El transportista seleccionado debe aceptar expresamente la reserva final antes de que se forme el acuerdo de transporte.',
  pl: 'Konta komercyjne muszą ukończyć onboarding Stripe XDrive i zachować gotowość handlową, zanim będą mogły publikować, składać oferty, przydzielać lub akceptować zlecenia transportowe. Gdy to konto działa jako nabywca transportu, XDrive może stosować limity ryzyka na etapie Publish i Award. Nowi nabywcy są domyślnie ograniczeni do maksymalnie 3 aktywnych zobowiązań transportowych i £2,500 niespłaconej ekspozycji transportowej, chyba że upoważniony Platform Owner dokona przeglądu tych limitów. Przy każdym Award nabywca musi osobno potwierdzić obowiązek płatności; obowiązek ten nie zależy od tego, czy nabywca, broker lub zleceniodawca został wcześniej opłacony przez własnego klienta lub inną osobę trzecią. Wybrany przewoźnik musi następnie wyraźnie zaakceptować ostateczną rezerwację przed zawarciem umowy transportowej.',
  ur:'کمرشل اکاؤنٹس کو ٹرانسپورٹ کام publish، quote، award یا accept کرنے سے پہلے XDrive Stripe onboarding مکمل کرنا اور commercially ready رہنا ضروری ہے۔ جب یہ اکاؤنٹ transport buyer کے طور پر کام کرے تو XDrive Publish اور Award پر risk limits لگا سکتا ہے۔ نئے buyers بطور default زیادہ سے زیادہ 3 active transport commitments اور £2,500 outstanding transport exposure تک محدود ہو سکتے ہیں جب تک authorised Platform Owner جائزہ نہ لے۔ ہر Award پر buyer کو payment obligation الگ سے confirm کرنا ہوگا؛ یہ obligation اس بات پر منحصر نہیں کہ buyer، broker یا ordering party کو اپنے customer یا کسی third party سے پہلے payment ملی ہے۔ منتخب carrier کو transport agreement بننے سے پہلے final booking واضح طور پر accept کرنا ہوگی۔',
  'pa-guru':'Commercial accounts ਨੂੰ transport work publish, quote, award ਜਾਂ accept ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ XDrive Stripe onboarding complete ਕਰਨਾ ਅਤੇ commercially ready ਰਹਿਣਾ ਲਾਜ਼ਮੀ ਹੈ। ਜਦ account transport buyer ਵਜੋਂ ਕੰਮ ਕਰੇ ਤਾਂ XDrive Publish ਅਤੇ Award ਤੇ risk limits ਲਾਗੂ ਕਰ ਸਕਦਾ ਹੈ। New buyers default ਤੌਰ ਤੇ ਵੱਧ ਤੋਂ ਵੱਧ 3 active transport commitments ਅਤੇ £2,500 outstanding transport exposure ਤੱਕ restricted ਹੋ ਸਕਦੇ ਹਨ ਜਦ ਤੱਕ authorised Platform Owner review ਨਾ ਕਰੇ। ਹਰ Award ਤੇ buyer ਨੂੰ payment obligation ਵੱਖਰੇ ਤੌਰ ਤੇ confirm ਕਰਨੀ ਪਵੇਗੀ; ਇਹ obligation ਇਸ ਗੱਲ ਤੇ depend ਨਹੀਂ ਕਰਦੀ ਕਿ buyer, broker ਜਾਂ ordering party ਨੂੰ ਆਪਣੇ customer ਜਾਂ third party ਤੋਂ ਪਹਿਲਾਂ payment ਮਿਲੀ ਹੈ। Selected carrier ਨੂੰ transport agreement ਬਣਨ ਤੋਂ ਪਹਿਲਾਂ final booking explicitly accept ਕਰਨੀ ਪਵੇਗੀ।',
  'pa-shah':'Commercial accounts نوں transport work publish، quote، award یا accept کرن توں پہلاں XDrive Stripe onboarding complete کرنا تے commercially ready رہنا لازم اے۔ جد account transport buyer طور کم کرے تاں XDrive Publish تے Award تے risk limits لا سکدا اے۔ New buyers default طور تے maximum 3 active transport commitments تے £2,500 outstanding transport exposure تک restricted ہو سکدے نیں جد تک authorised Platform Owner review نہ کرے۔ ہر Award تے buyer نوں payment obligation وکھری confirm کرنی پئے گی؛ ایہ obligation اس گل تے depend نئیں کردی کہ buyer، broker یا ordering party نوں اپنے customer یا third party توں پہلاں payment ملی اے۔ Selected carrier نوں transport agreement بنن توں پہلاں final booking explicitly accept کرنی پئے گی۔',
  hi:'Commercial accounts को transport work publish, quote, award या accept करने से पहले XDrive Stripe onboarding पूरा करना और commercially ready रहना आवश्यक है। जब account transport buyer के रूप में कार्य करता है, XDrive Publish और Award पर risk limits लगा सकता है। New buyers default रूप से अधिकतम 3 active transport commitments और £2,500 outstanding transport exposure तक restricted हो सकते हैं, जब तक authorised Platform Owner review न करे। प्रत्येक Award पर buyer को payment obligation अलग से confirm करना होगा; यह obligation इस बात पर निर्भर नहीं है कि buyer, broker या ordering party को अपने customer या third party से पहले payment मिला है। Selected carrier को transport agreement बनने से पहले final booking explicitly accept करनी होगी।',
  bn:'Commercial accounts-কে transport work publish, quote, award বা accept করার আগে XDrive Stripe onboarding সম্পন্ন করতে এবং commercially ready থাকতে হবে। Account transport buyer হিসেবে কাজ করলে XDrive Publish ও Award-এ risk limits প্রয়োগ করতে পারে। New buyers defaultভাবে সর্বোচ্চ 3 active transport commitments এবং £2,500 outstanding transport exposure পর্যন্ত restricted থাকতে পারে, যতক্ষণ না authorised Platform Owner review করে। প্রতিটি Award-এ buyer-কে payment obligation আলাদাভাবে confirm করতে হবে; buyer, broker বা ordering party তার customer বা third party থেকে আগে payment পেয়েছে কি না তার উপর এই obligation নির্ভর করে না। Selected carrier-কে transport agreement তৈরি হওয়ার আগে final booking explicitly accept করতে হবে।',
  gu:'Commercial accounts એ transport work publish, quote, award અથવા accept કરતા પહેલાં XDrive Stripe onboarding પૂર્ણ કરવું અને commercially ready રહેવું જરૂરી છે. Account transport buyer તરીકે કામ કરે ત્યારે XDrive Publish અને Award પર risk limits લાગુ કરી શકે છે. New buyers default રીતે વધુમાં વધુ 3 active transport commitments અને £2,500 outstanding transport exposure સુધી restricted હોઈ શકે છે, જ્યાં સુધી authorised Platform Owner review ન કરે. દરેક Award પર buyer એ payment obligation અલગથી confirm કરવી પડે છે; buyer, broker અથવા ordering party ને પોતાના customer અથવા third party પાસેથી પહેલાં payment મળ્યું છે કે નહીં તેના પર આ obligation આધારિત નથી. Selected carrier એ transport agreement બનતા પહેલાં final booking explicitly accept કરવી પડે છે.',

};

const ACCEPTANCE_LEAD: Record<LegalLanguage,string> = {
  en: 'I have read and agree to the agreements that apply to this account:',
  ro: 'Am citit și accept acordurile care se aplică acestui cont:',
  fr: 'J’ai lu et j’accepte les accords applicables à ce compte :',
  es: 'He leído y acepto los acuerdos aplicables a esta cuenta:',
  pl: 'Przeczytałem(-am) i akceptuję umowy mające zastosowanie do tego konta:',
  ur:'میں نے اس اکاؤنٹ پر لاگو معاہدے پڑھ لیے ہیں اور انہیں قبول کرتا/کرتی ہوں:',
  'pa-guru':'ਮੈਂ ਇਸ account ਤੇ ਲਾਗੂ agreements ਪੜ੍ਹ ਲਏ ਹਨ ਅਤੇ ਸਵੀਕਾਰ ਕਰਦਾ/ਕਰਦੀ ਹਾਂ:',
  'pa-shah':'میں اس account تے لاگو agreements پڑھ لئیاں نیں تے قبول کردا/کردی آں:',
  hi:'मैंने इस account पर लागू agreements पढ़ लिए हैं और उन्हें स्वीकार करता/करती हूँ:',
  bn:'আমি এই account-এ প্রযোজ্য agreements পড়েছি এবং গ্রহণ করছি:',
  gu:'મેં આ account પર લાગુ agreements વાંચ્યા છે અને સ્વીકારું છું:',

};

const TRANSPORT_CONTROL_HEADING: Record<LegalLanguage,string> = {
  en: 'Transport buyer controls',
  ro: 'Controale pentru transport buyer',
  fr: 'Contrôles de l’acheteur de transport',
  es: 'Controles del comprador de transporte',
  pl: 'Kontrole nabywcy transportu',
  ur:'Transport buyer controls',
  'pa-guru':'Transport buyer controls',
  'pa-shah':'Transport buyer controls',
  hi:'Transport buyer controls',
  bn:'Transport buyer controls',
  gu:'Transport buyer controls',

};

const ACCEPTANCE_STATEMENT: Record<LegalLanguage,(role: RegistrationLegalRole)=>string> = {
  en: (role) => 'I confirm that I can read and understand English. I have read the complete XDrive agreements listed for my ' + role + ' registration role in English, and I agree to them.',
  ro: (role) => 'Confirm că pot citi și înțelege limba română. Am citit integral acordurile XDrive enumerate pentru rolul meu de înregistrare ' + role + ', în limba română, și le accept.',
  fr: (role) => 'Je confirme que je peux lire et comprendre le français. J’ai lu intégralement les accords XDrive indiqués pour mon rôle d’inscription ' + role + ', en français, et je les accepte.',
  es: (role) => 'Confirmo que puedo leer y comprender español. He leído íntegramente los acuerdos XDrive indicados para mi rol de registro ' + role + ', en español, y los acepto.',
  pl: (role) => 'Potwierdzam, że potrafię czytać i rozumiem język polski. Przeczytałem(-am) w całości umowy XDrive wskazane dla mojej roli rejestracyjnej ' + role + ', w języku polskim, i je akceptuję.',
  ur:(role) => 'میں تصدیق کرتا/کرتی ہوں کہ میں اردو پڑھ اور سمجھ سکتا/سکتی ہوں۔ میں نے اپنے ' + role + ' registration role کے لیے درج مکمل XDrive agreements اردو میں پڑھے ہیں اور انہیں قبول کرتا/کرتی ہوں۔',
  'pa-guru':(role) => 'ਮੈਂ ਪੁਸ਼ਟੀ ਕਰਦਾ/ਕਰਦੀ ਹਾਂ ਕਿ ਮੈਂ ਪੰਜਾਬੀ (ਗੁਰਮੁਖੀ) ਪੜ੍ਹ ਅਤੇ ਸਮਝ ਸਕਦਾ/ਸਕਦੀ ਹਾਂ। ਮੈਂ ਆਪਣੇ ' + role + ' registration role ਲਈ ਦਰਸਾਏ ਪੂਰੇ XDrive agreements ਪੰਜਾਬੀ ਵਿੱਚ ਪੜ੍ਹੇ ਹਨ ਅਤੇ ਸਵੀਕਾਰ ਕਰਦਾ/ਕਰਦੀ ਹਾਂ।',
  'pa-shah':(role) => 'میں تصدیق کردا/کردی آں کہ میں پنجابی (شاہ مُکھی) پڑھ تے سمجھ سکدا/سکدی آں۔ میں اپنے ' + role + ' registration role لئی درج مکمل XDrive agreements پنجابی وچ پڑھے نیں تے قبول کردا/کردی آں۔',
  hi:(role) => 'मैं पुष्टि करता/करती हूँ कि मैं हिन्दी पढ़ और समझ सकता/सकती हूँ। मैंने अपने ' + role + ' registration role के लिए सूचीबद्ध पूरे XDrive agreements हिन्दी में पढ़े हैं और उन्हें स्वीकार करता/करती हूँ।',
  bn:(role) => 'আমি নিশ্চিত করছি যে আমি বাংলা পড়তে ও বুঝতে পারি। আমার ' + role + ' registration role-এর জন্য তালিকাভুক্ত সম্পূর্ণ XDrive agreements আমি বাংলায় পড়েছি এবং গ্রহণ করছি।',
  gu:(role) => 'હું પુષ્ટિ કરું છું કે હું ગુજરાતી વાંચી અને સમજી શકું છું. મારા ' + role + ' registration role માટે દર્શાવેલા સંપૂર્ણ XDrive agreements મેં ગુજરાતીમાં વાંચ્યા છે અને સ્વીકારું છું.',

};

export const getTransportControlNotice = (language: LegalLanguage) => TRANSPORT_CONTROL_NOTICE[language];
export const getTransportControlHeading = (language: LegalLanguage) => TRANSPORT_CONTROL_HEADING[language];
export const getAgreementAcceptanceLead = (language: LegalLanguage) => ACCEPTANCE_LEAD[language];
export const getLocalizedAcceptanceStatement = (role: RegistrationLegalRole, language: LegalLanguage) =>
  ACCEPTANCE_STATEMENT[language](role);

export const getLocalizedRegistrationDeclarations = (
  role: RegistrationLegalRole,
  language: LegalLanguage,
  english: { authority: string; role: string; privacy: string },
) => {
  if (language === 'en') return english;
  const localized = DECLARATIONS[language];
  return {
    authority: localized.authority,
    role: localized.roles[role],
    privacy: localized.privacy,
  };
};

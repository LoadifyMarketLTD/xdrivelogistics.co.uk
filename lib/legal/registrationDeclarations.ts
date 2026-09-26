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
};
const TRANSPORT_CONTROL_NOTICE: Record<LegalLanguage,string> = {
  en: 'When this account acts as transport buyer, XDrive may apply risk limits at Publish and Award. New buyers are currently restricted by default to up to 3 active transport commitments and £2,500 outstanding transport exposure unless reviewed by an authorised Platform Owner. At each Award, the buyer must separately confirm its payment obligation; the selected carrier must then explicitly accept the final booking before the transport agreement is formed.',
  ro: 'Atunci când acest cont acționează ca transport buyer, XDrive poate aplica limite de risc la Publish și Award. Buyerii noi sunt în prezent limitați implicit la până la 3 angajamente active de transport și £2,500 expunere restantă, dacă un Platform Owner autorizat nu revizuiește limita. La fiecare Award, buyer-ul trebuie să confirme separat obligația de plată; transportatorul selectat trebuie apoi să accepte explicit rezervarea finală înainte de formarea acordului de transport.',
  fr: 'Lorsque ce compte agit comme acheteur de transport, XDrive peut appliquer des limites de risque lors de la publication et de l’attribution. Les nouveaux acheteurs sont actuellement limités par défaut à 3 engagements actifs et £2,500 d’exposition impayée, sauf révision par un Platform Owner autorisé. À chaque attribution, l’acheteur doit confirmer séparément son obligation de paiement; le transporteur sélectionné doit ensuite accepter explicitement la réservation finale avant la formation du contrat de transport.',
  es: 'Cuando esta cuenta actúa como comprador de transporte, XDrive puede aplicar límites de riesgo en Publish y Award. Actualmente, los compradores nuevos están limitados por defecto a hasta 3 compromisos activos y £2,500 de exposición pendiente, salvo revisión por un Platform Owner autorizado. En cada Award, el comprador debe confirmar por separado su obligación de pago; el transportista seleccionado debe aceptar expresamente la reserva final antes de que se forme el acuerdo de transporte.',
  pl: 'Gdy to konto działa jako nabywca transportu, XDrive może stosować limity ryzyka na etapie Publish i Award. Nowi nabywcy są obecnie domyślnie ograniczeni do 3 aktywnych zobowiązań i £2,500 niespłaconej ekspozycji, chyba że upoważniony Platform Owner dokona przeglądu. Przy każdym Award nabywca musi osobno potwierdzić obowiązek płatności; wybrany przewoźnik musi następnie wyraźnie zaakceptować ostateczną rezerwację przed zawarciem umowy transportowej.',
};

const ACCEPTANCE_LEAD: Record<LegalLanguage,string> = {
  en: 'I have read and agree to the agreements that apply to this account:',
  ro: 'Am citit și accept acordurile care se aplică acestui cont:',
  fr: 'J’ai lu et j’accepte les accords applicables à ce compte :',
  es: 'He leído y acepto los acuerdos aplicables a esta cuenta:',
  pl: 'Przeczytałem(-am) i akceptuję umowy mające zastosowanie do tego konta:',
};

const TRANSPORT_CONTROL_HEADING: Record<LegalLanguage,string> = {
  en: 'Transport buyer controls',
  ro: 'Controale pentru transport buyer',
  fr: 'Contrôles de l’acheteur de transport',
  es: 'Controles del comprador de transporte',
  pl: 'Kontrole nabywcy transportu',
};

const ACCEPTANCE_STATEMENT: Record<LegalLanguage,(role: RegistrationLegalRole)=>string> = {
  en: (role) => `I agree to the XDrive agreements listed for my ${role} registration role in the selected language (en).`,
  ro: (role) => `Accept acordurile XDrive enumerate pentru rolul meu de înregistrare ${role}, în limba selectată (ro).`,
  fr: (role) => `J’accepte les accords XDrive indiqués pour mon rôle d’inscription ${role}, dans la langue sélectionnée (fr).`,
  es: (role) => `Acepto los acuerdos XDrive indicados para mi rol de registro ${role}, en el idioma seleccionado (es).`,
  pl: (role) => `Akceptuję umowy XDrive wskazane dla mojej roli rejestracyjnej ${role}, w wybranym języku (pl).`,
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

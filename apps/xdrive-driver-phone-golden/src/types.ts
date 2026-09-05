export type DriverProfile = {
  driverId: string;
  companyId: string;
};

export type DriverDocument = {
  id: string;
  docType: string;
  status: string;
  createdAt: string | null;
};

export type DriverPreferences = {
  notifyTracked: boolean;
  emailNotifications: boolean;
};

export type DriverJob = {
  id: string;
  status: string;
  currentStatus: string;
  pickupLocation: string;
  deliveryLocation: string;
  pickupDatetime: string | null;
  deliveryDatetime: string | null;
  clientName: string;
  loadDetails: string;
  deliveryPhotos: string[];
  podPhotos: string[];
};

export type DriverTab = "today" | "jobs" | "messages" | "documents" | "settings";

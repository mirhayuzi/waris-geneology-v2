import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LANG_KEY = "@waris_language";

type Language = "en" | "bm";

const translations = {
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.tree": "Tree",
    "nav.tools": "Tools",
    "nav.settings": "Settings",

    // Common
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    back: "Back",
    search: "Search",
    confirm: "Confirm",
    clear: "Clear",
    none: "None",
    loading: "Loading...",
    noData: "No data available",

    // Home
    greeting: "Assalamualaikum",
    membersRecorded: "members recorded",
    memberRecorded: "member recorded",
    living: "Living",
    deceased: "Deceased",
    marriages: "Marriages",
    quickActions: "Quick Actions",
    addFamilyMember: "Add Family Member",
    recordNewPerson: "Record a new person in your tree",
    viewTree: "View Tree",
    inviteFamily: "Invite Family",
    faraid: "Faraid",
    timeline: "Timeline",
    millerView: "Miller View",
    recentlyAdded: "Recently Added",
    startFamilyTree: "Start Your Family Tree",
    startFamilyTreeDesc: "Begin by adding yourself as the first member, then grow your tree by adding parents, siblings, and children.",
    addFirstMember: "Add First Member",
    searchMembers: "Search members by name, ethnicity...",
    results: "results",
    result: "result",
    noMembersFound: "No members found matching",

    // Tree
    familyTree: "Family Tree",
    members: "members",
    noFamilyTreeYet: "No Family Tree Yet",
    addFirstMemberTree: "Add your first family member to start building your tree.",
    treeView: "Tree",
    millerColumns: "Miller",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    resetZoom: "Reset",
    selectMember: "Select a member",
    parents: "Parents",
    spouses: "Spouses",
    children: "Children",
    siblings: "Siblings",

    // Tools
    tools: "Tools",
    powerfulFeatures: "Powerful features for your family tree",
    islamicTools: "Islamic Tools",
    faraidCalculator: "Faraid Calculator",
    calcIslamicInheritance: "Calculate Islamic inheritance distribution",
    mahramChecker: "Mahram Checker",
    checkMahramRelationships: "Check Mahram relationships between two people",
    exportPrint: "Export & Print",
    exportFamilyTreePDF: "Export Family Tree PDF",
    generatePrintableReport: "Generate a printable family tree report",
    printFamilyTree: "Print Family Tree",
    printDirectly: "Print your family tree directly",
    familyManagement: "Family Management",
    shareTreeWithRelatives: "Share your tree with siblings and relatives",
    familyStatistics: "Family Statistics",
    familyTimeline: "Family Timeline",
    viewChronologicalEvents: "View chronological family events",
    backupRestore: "Backup & Restore",
    backupRestoreDesc: "Save or restore your family data",

    // Settings
    settings: "Settings",
    family: "Family",
    tapToChangeName: "Tap to change family name",
    collaboration: "Collaboration",
    sharedMembers: "Shared Members",
    collaborators: "collaborators",
    collaborator: "collaborator",
    inviteFamilyEmail: "Invite Family",
    shareViaEmail: "Share your tree via email",
    language: "Language",
    currentLanguage: "English",
    switchLanguage: "Switch to Bahasa Malaysia",
    data: "Data",
    exportData: "Export Data",
    saveAsJSON: "Save family tree as CSV backup",
    importData: "Import Data",
    restoreFromBackup: "Restore from CSV backup file",
    resetAllData: "Reset All Data",
    deleteAllMembers: "Delete all members and start over",
    about: "About",
    madeForMalaysia: "Made for Malaysia",
    muslimNonMuslim: "Muslim & Non-Muslim families",

    // Member Form
    photo: "Photo (Optional)",
    addPhoto: "Add Photo",
    photoSet: "Photo set",
    choosePhoto: "Choose Photo",
    takePhoto: "Take Photo",
    chooseFromGallery: "Choose from Gallery",
    removePhoto: "Remove Photo",
    gender: "Gender",
    male: "Male (Lelaki)",
    female: "Female (Perempuan)",
    prefixTitle: "Prefix / Title (Optional)",
    selectPrefix: "Select prefix...",
    firstName: "First Name *",
    firstNamePlaceholder: "e.g. Ahmad, Siti, Wei Liang",
    bin: "Bin",
    binti: "Binti",
    fatherName: "(Father's Name)",
    fatherNamePlaceholder: "e.g. Yusof, Abdullah",
    lastName: "Last Name / Clan Name (Optional)",
    lastNamePlaceholder: "e.g. Al-Attas, Tan, Krishnan",
    dateOfBirth: "Date of Birth",
    placeOfBirth: "Place of Birth",
    placeOfBirthPlaceholder: "e.g. Kota Bharu, Kelantan",
    status: "Status",
    livingStatus: "Living (Hidup)",
    deceasedStatus: "Deceased (Meninggal)",
    dateOfDeath: "Date of Death",
    ethnicity: "Ethnicity",
    religion: "Religion",
    familyConnections: "Family Connections",
    notes: "Notes / Biography (Optional)",
    notesPlaceholder: "Short biography or notes...",
    tapToSelectDate: "Tap to select date",

    // Profile
    personalDetails: "Personal Details",
    prefix: "Prefix",
    parentsLabel: "Parents (Ibu Bapa)",
    spousesLabel: "Spouse(s) (Pasangan)",
    childrenLabel: "Children (Anak)",
    siblingsLabel: "Siblings (Adik-Beradik)",
    addChild: "+ Child",
    addSpouse: "+ Spouse",
    addParent: "+ Parent",
    setRoot: "Set Root",
    viewAsRoot: "View as Tree Root",
    viewAsRootDesc: "View family tree starting from this person",

    // Timeline
    familyTimelineTitle: "Family Timeline",
    birth: "Birth",
    death: "Death",
    marriage: "Marriage",
    noEvents: "No events to display. Add family members with dates to see the timeline.",

    // Backup
    backupTitle: "Backup & Restore",
    createBackup: "Create Backup",
    createBackupDesc: "Save your family data as CSV files",
    shareViaGmail: "Share via Gmail",
    shareViaGmailDesc: "Email your backup file",
    shareViaDrive: "Share to Google Drive",
    shareViaDriveDesc: "Save backup to Google Drive",
    restoreData: "Restore Data",
    restoreDataDesc: "Import family data from a backup file",
    lastBackup: "Last backup",
    never: "Never",

    // Simplified UI
    shortcuts: "Shortcuts",
    moreTools: "More Tools",
    addMember: "Add Member",
    editMember: "Edit Member",
    saveMember: "Save Member",
    required: "Required",
    enterFirstName: "Please enter the first name.",
    basicInfo: "Basic Info",
    moreDetails: "More details (optional)",
    hideDetails: "Hide extra details",
    connectionsHint: "Link this person to people already in your tree.",
    spouse: "Spouse",
    parent: "Parent",
    child: "Child",
    selectPersonAs: "Choose who is the",
    noAvailableMembers: "No available members to link.",
    chooseFromDevice: "Choose from Device",
    chooseFromDeviceDesc: "Gallery, camera or files",
    day: "Day",
    month: "Month",
    year: "Year",
    grandchildren: "Grandchildren",
    greatGrandchildren: "Great-grandchildren",
    noRelativesYet: "No relatives linked yet. Use the buttons above to add family.",
    deleteMember: "Delete Member",
    deleteMemberConfirm: "Remove this person from the family tree?",
    personNotFound: "Person not found",
    goBack: "Go Back",
    treeRoot: "Tree root",
    generating: "Generating...",
    noDataTitle: "No Data",
    addMembersFirst: "Please add family members first.",
    somethingWentWrong: "Something went wrong. Please try again.",
    aboutFaraid: "About Faraid",
    aboutFaraidDesc: "Faraid is the Islamic law of inheritance. The calculator uses your family tree to find eligible heirs and work out their shares.",
    exportCSV: "Export CSV",
    exportCSVDesc: "Save family data as CSV files with photos",
    inviteFamilyDesc: "Share your tree with relatives by email",
    version: "Version",
  },
  bm: {
    // Navigation
    "nav.home": "Utama",
    "nav.tree": "Salasilah",
    "nav.tools": "Alat",
    "nav.settings": "Tetapan",

    // Common
    save: "Simpan",
    cancel: "Batal",
    delete: "Padam",
    edit: "Sunting",
    back: "Kembali",
    search: "Cari",
    confirm: "Sahkan",
    clear: "Kosongkan",
    none: "Tiada",
    loading: "Memuatkan...",
    noData: "Tiada data",

    // Home
    greeting: "Assalamualaikum",
    membersRecorded: "ahli direkodkan",
    memberRecorded: "ahli direkodkan",
    living: "Hidup",
    deceased: "Meninggal",
    marriages: "Perkahwinan",
    quickActions: "Tindakan Pantas",
    addFamilyMember: "Tambah Ahli Keluarga",
    recordNewPerson: "Rekod ahli baru dalam salasilah anda",
    viewTree: "Lihat Salasilah",
    inviteFamily: "Jemput Keluarga",
    faraid: "Faraid",
    timeline: "Garis Masa",
    millerView: "Paparan Miller",
    recentlyAdded: "Baru Ditambah",
    startFamilyTree: "Mulakan Salasilah Keluarga",
    startFamilyTreeDesc: "Mulakan dengan menambah diri anda sebagai ahli pertama, kemudian tambah ibu bapa, adik-beradik, dan anak-anak.",
    addFirstMember: "Tambah Ahli Pertama",
    searchMembers: "Cari ahli mengikut nama, etnik...",
    results: "keputusan",
    result: "keputusan",
    noMembersFound: "Tiada ahli ditemui untuk",

    // Tree
    familyTree: "Salasilah Keluarga",
    members: "ahli",
    noFamilyTreeYet: "Tiada Salasilah Lagi",
    addFirstMemberTree: "Tambah ahli keluarga pertama untuk mula membina salasilah anda.",
    treeView: "Salasilah",
    millerColumns: "Miller",
    zoomIn: "Zum Masuk",
    zoomOut: "Zum Keluar",
    resetZoom: "Set Semula",
    selectMember: "Pilih ahli",
    parents: "Ibu Bapa",
    spouses: "Pasangan",
    children: "Anak",
    siblings: "Adik-Beradik",

    // Tools
    tools: "Alatan",
    powerfulFeatures: "Ciri berkuasa untuk salasilah keluarga anda",
    islamicTools: "Alatan Islam",
    faraidCalculator: "Kalkulator Faraid",
    calcIslamicInheritance: "Kira pengagihan harta pusaka Islam",
    mahramChecker: "Semak Mahram",
    checkMahramRelationships: "Semak hubungan Mahram antara dua orang",
    exportPrint: "Eksport & Cetak",
    exportFamilyTreePDF: "Eksport PDF Salasilah",
    generatePrintableReport: "Jana laporan salasilah yang boleh dicetak",
    printFamilyTree: "Cetak Salasilah",
    printDirectly: "Cetak salasilah anda secara terus",
    familyManagement: "Pengurusan Keluarga",
    shareTreeWithRelatives: "Kongsi salasilah dengan adik-beradik dan saudara",
    familyStatistics: "Statistik Keluarga",
    familyTimeline: "Garis Masa Keluarga",
    viewChronologicalEvents: "Lihat peristiwa keluarga mengikut kronologi",
    backupRestore: "Sandaran & Pulih",
    backupRestoreDesc: "Simpan atau pulihkan data keluarga anda",

    // Settings
    settings: "Tetapan",
    family: "Keluarga",
    tapToChangeName: "Ketik untuk tukar nama keluarga",
    collaboration: "Kolaborasi",
    sharedMembers: "Ahli Dikongsi",
    collaborators: "kolaborator",
    collaborator: "kolaborator",
    inviteFamilyEmail: "Jemput Keluarga",
    shareViaEmail: "Kongsi salasilah melalui emel",
    language: "Bahasa",
    currentLanguage: "Bahasa Malaysia",
    switchLanguage: "Tukar ke English",
    data: "Data",
    exportData: "Eksport Data",
    saveAsJSON: "Simpan salasilah sebagai sandaran CSV",
    importData: "Import Data",
    restoreFromBackup: "Pulihkan dari fail sandaran CSV",
    resetAllData: "Set Semula Semua Data",
    deleteAllMembers: "Padam semua ahli dan mula semula",
    about: "Perihal",
    madeForMalaysia: "Dibuat untuk Malaysia",
    muslimNonMuslim: "Keluarga Muslim & Bukan Muslim",

    // Member Form
    photo: "Gambar (Pilihan)",
    addPhoto: "Tambah Gambar",
    photoSet: "Gambar ditetapkan",
    choosePhoto: "Pilih Gambar",
    takePhoto: "Ambil Gambar",
    chooseFromGallery: "Pilih dari Galeri",
    removePhoto: "Buang Gambar",
    gender: "Jantina",
    male: "Lelaki",
    female: "Perempuan",
    prefixTitle: "Gelaran (Pilihan)",
    selectPrefix: "Pilih gelaran...",
    firstName: "Nama Pertama *",
    firstNamePlaceholder: "cth. Ahmad, Siti, Wei Liang",
    bin: "Bin",
    binti: "Binti",
    fatherName: "(Nama Bapa)",
    fatherNamePlaceholder: "cth. Yusof, Abdullah",
    lastName: "Nama Akhir / Nama Keluarga (Pilihan)",
    lastNamePlaceholder: "cth. Al-Attas, Tan, Krishnan",
    dateOfBirth: "Tarikh Lahir",
    placeOfBirth: "Tempat Lahir",
    placeOfBirthPlaceholder: "cth. Kota Bharu, Kelantan",
    status: "Status",
    livingStatus: "Hidup",
    deceasedStatus: "Meninggal Dunia",
    dateOfDeath: "Tarikh Meninggal",
    ethnicity: "Etnik",
    religion: "Agama",
    familyConnections: "Hubungan Keluarga",
    notes: "Nota / Biografi (Pilihan)",
    notesPlaceholder: "Biografi ringkas atau nota...",
    tapToSelectDate: "Ketik untuk pilih tarikh",

    // Profile
    personalDetails: "Maklumat Peribadi",
    prefix: "Gelaran",
    parentsLabel: "Ibu Bapa",
    spousesLabel: "Pasangan",
    childrenLabel: "Anak",
    siblingsLabel: "Adik-Beradik",
    addChild: "+ Anak",
    addSpouse: "+ Pasangan",
    addParent: "+ Ibu Bapa",
    setRoot: "Tetapkan Akar",
    viewAsRoot: "Lihat Sebagai Akar Salasilah",
    viewAsRootDesc: "Lihat salasilah bermula dari orang ini",

    // Timeline
    familyTimelineTitle: "Garis Masa Keluarga",
    birth: "Kelahiran",
    death: "Kematian",
    marriage: "Perkahwinan",
    noEvents: "Tiada peristiwa untuk dipaparkan. Tambah ahli keluarga dengan tarikh untuk melihat garis masa.",

    // Backup
    backupTitle: "Sandaran & Pulih",
    createBackup: "Buat Sandaran",
    createBackupDesc: "Simpan data keluarga sebagai fail CSV",
    shareViaGmail: "Kongsi melalui Gmail",
    shareViaGmailDesc: "Hantar fail sandaran melalui emel",
    shareViaDrive: "Kongsi ke Google Drive",
    shareViaDriveDesc: "Simpan sandaran ke Google Drive",
    restoreData: "Pulihkan Data",
    restoreDataDesc: "Import data keluarga dari fail sandaran",
    lastBackup: "Sandaran terakhir",
    never: "Belum pernah",

    // Simplified UI
    shortcuts: "Pintasan",
    moreTools: "Alatan Lain",
    addMember: "Tambah Ahli",
    editMember: "Sunting Ahli",
    saveMember: "Simpan Ahli",
    required: "Diperlukan",
    enterFirstName: "Sila masukkan nama pertama.",
    basicInfo: "Maklumat Asas",
    moreDetails: "Maklumat lanjut (pilihan)",
    hideDetails: "Sembunyi maklumat lanjut",
    connectionsHint: "Pautkan orang ini kepada ahli yang sudah ada dalam salasilah.",
    spouse: "Pasangan",
    parent: "Ibu/Bapa",
    child: "Anak",
    selectPersonAs: "Pilih siapa",
    noAvailableMembers: "Tiada ahli untuk dipautkan.",
    chooseFromDevice: "Pilih dari Peranti",
    chooseFromDeviceDesc: "Galeri, kamera atau fail",
    day: "Hari",
    month: "Bulan",
    year: "Tahun",
    grandchildren: "Cucu",
    greatGrandchildren: "Cicit",
    noRelativesYet: "Belum ada saudara dipautkan. Guna butang di atas untuk tambah keluarga.",
    deleteMember: "Padam Ahli",
    deleteMemberConfirm: "Buang orang ini dari salasilah keluarga?",
    personNotFound: "Ahli tidak ditemui",
    goBack: "Kembali",
    treeRoot: "Akar salasilah",
    generating: "Sedang dijana...",
    noDataTitle: "Tiada Data",
    addMembersFirst: "Sila tambah ahli keluarga dahulu.",
    somethingWentWrong: "Sesuatu tidak kena. Sila cuba lagi.",
    aboutFaraid: "Tentang Faraid",
    aboutFaraidDesc: "Faraid ialah hukum pusaka Islam. Kalkulator menggunakan salasilah anda untuk mengenal pasti waris dan mengira bahagian mereka.",
    exportCSV: "Eksport CSV",
    exportCSVDesc: "Simpan data keluarga sebagai fail CSV dengan gambar",
    inviteFamilyDesc: "Kongsi salasilah dengan saudara melalui emel",
    version: "Versi",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

interface I18nContextType {
  lang: Language;
  t: (key: TranslationKey) => string;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((stored) => {
      if (stored === "en" || stored === "bm") setLangState(stored);
    });
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    AsyncStorage.setItem(LANG_KEY, newLang);
  }, []);

  const toggleLang = useCallback(() => {
    const newLang = lang === "en" ? "bm" : "en";
    setLang(newLang);
  }, [lang, setLang]);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[lang][key] || translations.en[key] || key;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, t, setLang, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

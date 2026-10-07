export type Language = 'th' | 'en';

export interface Translations {
  common: {
    schoolName: string;
    schoolNameChinese: string;
    officialBadge: string;
    portalTitle: string;
    academicYear: string;
    search: string;
    filter: string;
    all: string;
    active: string;
    inactive: string;
    loading: string;
    save: string;
    saved: string;
    cancel: string;
    confirm: string;
    edit: string;
    delete: string;
    add: string;
    close: string;
    back: string;
    refresh: string;
    status: string;
    actions: string;
    success: string;
    error: string;
    today: string;
    yesterday: string;
    last7Days: string;
    last30Days: string;
    lastUpdated: string;
    noData: string;
    print: string;
    export: string;
    import: string;
    total: string;
    items: string;
    baht: string;
    reset: string;
    anonymous: string;
  };
  nav: {
    financeAccounting: string;
    coopStore: string;
    registrar: string;
    hrAdmin: string;
    pr: string;
    generalAdmin: string;
    dashboard: string;
    posFees: string;
    adminReports: string;
    posShop: string;
    adminProducts: string;
    posWalletTopup: string;
    adminWalletStudents: string;
    adminStudents: string;
    adminForms: string;
    adminKpi: string;
    adminAttendance: string;
    adminUsers: string;
    adminWebsite: string;
    postAssistant: string;
    audioRemote: string;
    qrGenerator: string;
    settings: string;
    signedInAs: string;
    role: string;
    logout: string;
    backToLaunchpad: string;
    navigationMenu: string;
  };
  roles: {
    admin: string;
    executive: string;
    teacher: string;
    academicStaff: string;
    supportStaff: string;
    cashier: string;
    staff: string;
  };
  home: {
    greetingMorning: string;
    greetingAfternoon: string;
    greetingEvening: string;
    launchpadTitle: string;
    launchpadSubtitle: string;
    searchPlaceholder: string;
    noResults: string;
    quickStats: string;
  };
  login: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    googleLogin: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    loginButton: string;
    schoolFooter: string;
    invalidDomain: string;
    authFailed: string;
    invalidCredentials: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    totalReceived: string;
    tuitionFees: string;
    coopShop: string;
    walletTopup: string;
    syncStatus: string;
    pending: string;
    processing: string;
    completed: string;
    failed: string;
    websiteOverview: string;
    newsArticles: string;
    photoAlbums: string;
    personnel: string;
    today: string;
    yesterday: string;
    updated: string;
    items: string;
    dateSummaryPrefix: string;
  };
  fees: {
    title: string;
    subtitle: string;
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    searchStudentPlaceholder: string;
    searchTitle: string;
    searchHint: string;
    changeStudent: string;
    noUnpaid: string;
    noUnpaidHint: string;
    unpaidList: string;
    dueDate: string;
    overdue: string;
    selectedCount: string;
    totalDue: string;
    proceedToPayment: string;
    selectMethod: string;
    paymentMethod: string;
    cash: string;
    transfer: string;
    qrScan: string;
    qrScanHint: string;
    schoolAccount: string;
    accountName: string;
    copyAccount: string;
    copied: string;
    confirmPayment: string;
    paymentSuccess: string;
    receiptNumber: string;
    printReceipt: string;
    newTransaction: string;
    nextStudent: string;
    invoiceItems: string;
    amountToPay: string;
    slipNotice: string;
  };
  shop: {
    title: string;
    cart: string;
    emptyCart: string;
    emptyCartHint: string;
    clearCart: string;
    scanOrSearch: string;
    readyToScan: string;
    notFound: string;
    checkout: string;
    confirmPayment: string;
    amountDue: string;
    selectPaymentMethod: string;
    cashReceived: string;
    exactCash: string;
    change: string;
    insufficientCash: string;
    studentWallet: string;
    receipt: string;
    itemCount: string;
    catalog: string;
    offlineNotice: string;
    totalAmount: string;
    printSlip: string;
    refCode: string;
    item: string;
    quantity: string;
    price: string;
    totalNet: string;
    walletInfo: string;
    tapOrScanStudentCard: string;
    changeCard: string;
    dailyUsage: string;
  };
  products: {
    title: string;
    subtitle: string;
    addProduct: string;
    hideForm: string;
    totalProducts: string;
    lowStockAlert: string;
    stockValue: string;
    productName: string;
    price: string;
    stock: string;
    barcode: string;
    category: string;
    inStock: string;
    outOfStock: string;
    saveProduct: string;
  };
  wallet: {
    topupTitle: string;
    servicePoint: string;
    manageTitle: string;
    manageSubtitle: string;
    tapCard: string;
    tapCardOrManual: string;
    currentBalance: string;
    dailyLimit: string;
    unlimited: string;
    spentToday: string;
    linkCard: string;
    hasCard: string;
    noCard: string;
    lowBalance: string;
    searchPlaceholder: string;
  };
  students: {
    title: string;
    subtitle: string;
    studentId: string;
    studentName: string;
    grade: string;
    classroom: string;
    promote: string;
    addStudent: string;
    allGrades: string;
  };
  kpi: {
    title: string;
    subtitle: string;
    selfEvaluation: string;
    supervisorEvaluation: string;
    analytics: string;
    totalScore: string;
    evaluationPeriod: string;
    draft: string;
    submitted: string;
    evaluated: string;
    confidentialNotice: string;
  };
  forms: {
    title: string;
    subtitle: string;
    createForm: string;
    responses: string;
    formTemplates: string;
    nongFahAi: string;
  };
}

export const translations: Record<Language, Translations> = {
  th: {
    common: {
      schoolName: 'โรงเรียนสมคิดวิทยา',
      schoolNameChinese: 'Somkidvittaya学校',
      officialBadge: 'Somkidvittaya Official',
      portalTitle: 'SV Portal',
      academicYear: 'ปีการศึกษา 2568',
      search: 'ค้นหา...',
      filter: 'ตัวกรอง',
      all: 'ทั้งหมด',
      active: 'เปิดใช้งาน',
      inactive: 'ปิดใช้งาน',
      loading: 'กำลังโหลดข้อมูล...',
      save: 'บันทึก',
      saved: 'บันทึกสำเร็จ',
      cancel: 'ยกเลิก',
      confirm: 'ยืนยัน',
      edit: 'แก้ไข',
      delete: 'ลบ',
      add: 'เพิ่ม',
      close: 'ปิด',
      back: 'ย้อนกลับ',
      refresh: 'รีเฟรช',
      status: 'สถานะ',
      actions: 'จัดการ',
      success: 'สำเร็จ',
      error: 'เกิดข้อผิดพลาด',
      today: 'วันนี้',
      yesterday: 'เมื่อวาน',
      last7Days: '7 วันล่าสุด',
      last30Days: '30 วันล่าสุด',
      lastUpdated: 'อัปเดตล่าสุด',
      noData: 'ไม่พบข้อมูลในระบบ',
      print: 'พิมพ์',
      export: 'ส่งออกข้อมูล',
      import: 'นำเข้าข้อมูล',
      total: 'ยอดรวมทั้งสิ้น',
      items: 'รายการ',
      baht: 'บาท',
      reset: 'เริ่มใหม่',
      anonymous: 'ไม่เปิดเผยชื่อผู้ประเมิน',
    },
    nav: {
      financeAccounting: 'งานการเงิน & บัญชี',
      coopStore: 'งานร้านค้าสหกรณ์',
      registrar: 'งานทะเบียน',
      hrAdmin: 'งานบุคคล & บริหาร',
      pr: 'งานประชาสัมพันธ์',
      generalAdmin: 'งานบริหารทั่วไป',
      dashboard: 'แดชบอร์ดสรุปยอด',
      posFees: 'ชำระค่าเทอม',
      adminReports: 'รายงานการเงิน',
      posShop: 'POS ขายสินค้า',
      adminProducts: 'จัดการสินค้า',
      posWalletTopup: 'เติมเงิน Wallet',
      adminWalletStudents: 'Wallet นักเรียน',
      adminStudents: 'ข้อมูลนักเรียน',
      adminForms: 'ระบบแบบฟอร์ม (SV-Forms)',
      adminKpi: 'ประเมินบุคลากร (KPI)',
      adminAttendance: 'ลงเวลาทำงาน',
      adminUsers: 'จัดการผู้ใช้งาน',
      adminWebsite: 'จัดการเว็บไซต์',
      postAssistant: 'Social Post Assistant',
      audioRemote: 'ระบบกระจายเสียง (Audio Remote)',
      qrGenerator: 'สร้าง QR Code',
      settings: 'การตั้งค่า',
      signedInAs: 'เข้าสู่ระบบในชื่อ',
      role: 'ตำแหน่ง',
      logout: 'ออกจากระบบ',
      backToLaunchpad: 'กลับสู่หน้าหลัก',
      navigationMenu: 'เมนูระบบงาน',
    },
    roles: {
      admin: 'ผู้ดูแลระบบ',
      executive: 'ผู้บริหาร',
      teacher: 'ครูผู้สอน',
      academicStaff: 'บุคลากรวิชาการ',
      supportStaff: 'บุคลากรสายสนับสนุน',
      cashier: 'เจ้าหน้าที่การเงิน/ร้านค้า',
      staff: 'เจ้าหน้าที่',
    },
    home: {
      greetingMorning: 'สวัสดีตอนเช้า',
      greetingAfternoon: 'สวัสดีตอนบ่าย',
      greetingEvening: 'สวัสดีตอนเย็น',
      launchpadTitle: 'ศูนย์รวมระบบบริหารจัดการโรงเรียน',
      launchpadSubtitle: 'เข้าถึงระบบงานและบริการต่างๆ ของโรงเรียนสมคิดวิทยาอย่างสะดวกรวดเร็ว',
      searchPlaceholder: 'ค้นหาระบบงานหรือเครื่องมือ...',
      noResults: 'ไม่พบระบบงานที่ค้นหา',
      quickStats: 'สถิติภาพรวม',
    },
    login: {
      welcomeTitle: 'ยินดีต้อนรับสู่ SV Portal',
      welcomeSubtitle: 'เข้าสู่ระบบเพื่อใช้งาน (ใช้ระบบจัดการผู้ใช้ของโรงเรียน)',
      googleLogin: 'เข้าสู่ระบบด้วย Google Account โรงเรียน',
      email: 'อีเมล',
      emailPlaceholder: 'อีเมลโรงเรียน (@somkidvittaya.ac.th)',
      password: 'รหัสผ่าน',
      passwordPlaceholder: 'รหัสผ่านของคุณ',
      loginButton: 'เข้าสู่ระบบ',
      schoolFooter: 'โรงเรียนสมคิดวิทยา (Somkidvittaya学校)',
      invalidDomain: 'อนุญาตให้เข้าสู่ระบบด้วยอีเมลของโรงเรียน (@somkidvittaya.ac.th) เท่านั้น',
      authFailed: 'ไม่สามารถยืนยันตัวตนกับระบบได้ กรุณาลองใหม่อีกครั้ง',
      invalidCredentials: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    },
    dashboard: {
      title: 'แดชบอร์ดสรุปยอดรวม',
      subtitle: 'ข้อมูลสรุปรายรับ ค่าเทอม ร้านสหกรณ์ และการเติมเงิน',
      totalReceived: 'ยอดรับรวมทั้งสิ้น',
      tuitionFees: 'ค่าเทอมและค่าธรรมเนียม',
      coopShop: 'ร้านค้าสหกรณ์',
      walletTopup: 'เติมเงิน Wallet นักเรียน',
      syncStatus: 'สถานะคิวซิงค์ข้อมูล',
      pending: 'รอการส่ง (Pending)',
      processing: 'กำลังส่ง (Processing)',
      completed: 'สำเร็จ (Completed)',
      failed: 'ล้มเหลว (Failed)',
      websiteOverview: 'ข้อมูลหน้าเว็บไซต์',
      newsArticles: 'ข่าวสาร',
      photoAlbums: 'อัลบั้มภาพ',
      personnel: 'บุคลากร',
      today: 'วันนี้',
      yesterday: 'เมื่อวาน',
      updated: 'อัปเดต',
      items: 'รายการ',
      dateSummaryPrefix: 'ข้อมูลสรุปรายรับ ค่าเทอม ร้านสหกรณ์ และการเติมเงิน ณ วันที่',
    },
    fees: {
      title: 'รับชำระค่าธรรมเนียม',
      subtitle: 'ระบบรับชำระเงินค่าเทอมและค่าธรรมเนียมการศึกษาแบบครบวงจร',
      step1: 'ค้นหา',
      step2: 'เลือกรายการ',
      step3: 'ชำระเงิน',
      step4: 'เสร็จสิ้น',
      searchStudentPlaceholder: 'รหัสนักเรียน หรือ ชื่อ-นามสกุล...',
      searchTitle: 'ค้นหานักเรียน',
      searchHint: 'กรอกรหัสนักเรียนหรือชื่อเพื่อเริ่มการรับชำระ',
      changeStudent: 'เปลี่ยนนักเรียน',
      noUnpaid: 'ไม่มีรายการค้างชำระ',
      noUnpaidHint: 'นักเรียนรายนี้ชำระค่าธรรมเนียมครบถ้วนแล้ว',
      unpaidList: 'รายการค้างชำระ',
      dueDate: 'กำหนดชำระ',
      overdue: 'เกินกำหนด',
      selectedCount: 'เลือกแล้ว',
      totalDue: 'ยอดรวมที่ต้องชำระ',
      proceedToPayment: 'ดำเนินการชำระเงิน',
      selectMethod: 'เลือกวิธีชำระเงิน',
      paymentMethod: 'ช่องทางการชำระเงิน',
      cash: 'เงินสด',
      transfer: 'โอนธนาคาร',
      qrScan: 'สแกน QR Code',
      qrScanHint: 'ให้ผู้ปกครองสแกน QR Code ด้านบนเพื่อชำระเงิน',
      schoolAccount: 'บัญชีรับโอนของโรงเรียน',
      accountName: 'ชื่อบัญชี: โรงเรียนสมคิดวิทยา',
      copyAccount: 'คัดลอก',
      copied: 'คัดลอกเลขที่บัญชีแล้ว',
      confirmPayment: 'ยืนยันรับชำระเงิน',
      paymentSuccess: 'ชำระเงินสำเร็จ',
      receiptNumber: 'เลขที่ใบเสร็จ',
      printReceipt: 'พิมพ์ใบเสร็จ',
      newTransaction: 'เริ่มรายการใหม่',
      nextStudent: 'รับชำระรายถัดไป',
      invoiceItems: 'รายการค่าธรรมเนียม',
      amountToPay: 'ยอดที่ต้องชำระ',
      slipNotice: 'ใบเสร็จรับเงินอย่างเป็นทางการ',
    },
    shop: {
      title: 'POS คิดเงินร้านค้าสหกรณ์',
      cart: 'ตะกร้าสินค้า',
      emptyCart: 'ยังไม่มีสินค้าในตะกร้า',
      emptyCartHint: 'สแกนบาร์โค้ดหรือแตะเลือกสินค้าด้านขวาเพื่อเพิ่มลงตะกร้า',
      clearCart: 'ล้างตะกร้า',
      scanOrSearch: 'ค้นหาสินค้า หรือ สแกนบาร์โค้ด...',
      readyToScan: 'พร้อมสแกนบาร์โค้ด',
      notFound: 'ไม่พบสินค้าที่ค้นหา',
      checkout: 'ชำระเงิน',
      confirmPayment: 'ยืนยันการชำระเงิน',
      amountDue: 'ยอดที่ต้องชำระ',
      selectPaymentMethod: 'เลือกช่องทางการชำระเงิน',
      cashReceived: 'เงินสดที่ได้รับ (บาท)',
      exactCash: 'จ่ายพอดี',
      change: 'เงินทอน',
      insufficientCash: 'ยอดเงินยังไม่พอ',
      studentWallet: 'Wallet นักเรียน',
      receipt: 'ใบเสร็จรับเงิน',
      itemCount: 'ชิ้น',
      catalog: 'แคตตาล็อกสินค้า',
      offlineNotice: 'ออฟไลน์ — ข้อมูลจะซิงค์เมื่อเชื่อมต่อใหม่',
      totalAmount: 'ยอดรวมทั้งสิ้น',
      printSlip: 'พิมพ์สลิป',
      refCode: 'รหัสอ้างอิง',
      item: 'รายการ',
      quantity: 'จำนวน',
      price: 'ราคา',
      totalNet: 'ยอดสุทธิ',
      walletInfo: 'ข้อมูล Wallet',
      tapOrScanStudentCard: 'แตะบัตรนักเรียน หรือ สแกนบาร์โค้ดรหัส',
      changeCard: 'เปลี่ยนบัตร / ผู้ใช้งานอื่น',
      dailyUsage: 'การใช้วงเงินรายวัน',
    },
    products: {
      title: 'จัดการสินค้าและคลังสหกรณ์',
      subtitle: 'ควบคุมรายการสินค้า ราคา บาร์โค้ด และตรวจสอบจำนวนสต็อกคงเหลือ',
      addProduct: 'เพิ่มสินค้าใหม่',
      hideForm: 'ซ่อนแบบฟอร์ม',
      totalProducts: 'สินค้าทั้งหมด',
      lowStockAlert: 'สต็อกใกล้หมด (< 10)',
      stockValue: 'มูลค่าสต็อกรวม',
      productName: 'ชื่อสินค้า',
      price: 'ราคา (บาท)',
      stock: 'จำนวนสต็อก',
      barcode: 'บาร์โค้ด',
      category: 'หมวดหมู่',
      inStock: 'มีสินค้า',
      outOfStock: 'สินค้าหมด',
      saveProduct: 'บันทึกสินค้า',
    },
    wallet: {
      topupTitle: 'เติมเงิน Wallet นักเรียน',
      servicePoint: 'ระบบเติมเงินจุดบริการ',
      manageTitle: 'จัดการ Wallet นักเรียน',
      manageSubtitle: 'ตรวจสอบยอดเงินคงเหลือ กำหนดวงเงินใช้จ่ายรายวัน ผูกบัตร NFC',
      tapCard: 'แตะบัตรนักเรียน',
      tapCardOrManual: 'หรือกรอกรหัสนักเรียนด้วยตนเอง',
      currentBalance: 'ยอดเงินคงเหลือ',
      dailyLimit: 'วงเงินใช้จ่ายรายวัน',
      unlimited: 'ไม่จำกัด',
      spentToday: 'ใช้ไปแล้ววันนี้',
      linkCard: 'ผูกบัตร NFC',
      hasCard: 'มีบัตร',
      noCard: 'ไม่มีบัตร',
      lowBalance: 'ยอดต่ำ',
      searchPlaceholder: 'ค้นหารหัสหรือชื่อนักเรียน...',
    },
    students: {
      title: 'ทะเบียนข้อมูลนักเรียน',
      subtitle: 'จัดการรายชื่อ ข้อมูลประจำตัว และระดับชั้นเรียน',
      studentId: 'รหัสนักเรียน',
      studentName: 'ชื่อ-นามสกุล',
      grade: 'ระดับชั้น',
      classroom: 'ห้องเรียน',
      promote: 'เลื่อนชั้นเรียน',
      addStudent: 'เพิ่มนักเรียน',
      allGrades: 'ทุกระดับชั้น',
    },
    kpi: {
      title: 'ระบบประเมินผลการปฏิบัติงาน (KPI)',
      subtitle: 'ประเมินตนเอง กรรมการประเมิน และสถิติการประเมิน',
      selfEvaluation: 'แบบประเมินตนเอง',
      supervisorEvaluation: 'แบบประเมินโดยกรรมการ',
      analytics: 'รายงานและสถิติภาพรวม',
      totalScore: 'คะแนนรวม',
      evaluationPeriod: 'รอบการประเมิน',
      draft: 'ฉบับร่าง',
      submitted: 'ส่งการประเมินแล้ว',
      evaluated: 'ประเมินเรียบร้อย',
      confidentialNotice: 'ผลการประเมินถูกเก็บเป็นความลับและไม่เปิดเผยชื่อผู้ประเมิน',
    },
    forms: {
      title: 'ระบบแบบฟอร์มโรงเรียน (SV-Forms)',
      subtitle: 'สร้างและจัดการแบบฟอร์มออนไลน์ พร้อมระบบวิเคราะห์ข้อมูล',
      createForm: 'สร้างแบบฟอร์มใหม่',
      responses: 'รายการตอบกลับ',
      formTemplates: 'แม่แบบฟอร์ม',
      nongFahAi: 'น้องฟ้า AI ผู้ช่วย',
    },
  },
  en: {
    common: {
      schoolName: 'Somkidvittaya School',
      schoolNameChinese: 'Somkidvittaya学校',
      officialBadge: 'Somkidvittaya Official',
      portalTitle: 'SV Portal',
      academicYear: 'Academic Year 2025',
      search: 'Search...',
      filter: 'Filter',
      all: 'All',
      active: 'Active',
      inactive: 'Inactive',
      loading: 'Loading data...',
      save: 'Save',
      saved: 'Saved successfully',
      cancel: 'Cancel',
      confirm: 'Confirm',
      edit: 'Edit',
      delete: 'Delete',
      add: 'Add',
      close: 'Close',
      back: 'Back',
      refresh: 'Refresh',
      status: 'Status',
      actions: 'Actions',
      success: 'Success',
      error: 'An error occurred',
      today: 'Today',
      yesterday: 'Yesterday',
      last7Days: 'Last 7 Days',
      last30Days: 'Last 30 Days',
      lastUpdated: 'Last updated',
      noData: 'No records found',
      print: 'Print',
      export: 'Export Data',
      import: 'Import Data',
      total: 'Total Amount',
      items: 'items',
      baht: 'THB',
      reset: 'Reset',
      anonymous: 'Anonymous Evaluator',
    },
    nav: {
      financeAccounting: 'Finance & Accounting',
      coopStore: 'Co-op Store',
      registrar: 'Registrar & Records',
      hrAdmin: 'HR & Administration',
      pr: 'Public Relations',
      generalAdmin: 'General Administration',
      dashboard: 'Summary Dashboard',
      posFees: 'Tuition Payment',
      adminReports: 'Financial Reports',
      posShop: 'POS Cashier',
      adminProducts: 'Manage Products',
      posWalletTopup: 'Wallet Top-up',
      adminWalletStudents: 'Student Wallets',
      adminStudents: 'Student Records',
      adminForms: 'SV-Forms System',
      adminKpi: 'Staff KPI Evaluation',
      adminAttendance: 'Time Attendance',
      adminUsers: 'User Management',
      adminWebsite: 'Website Manager',
      postAssistant: 'Social Post Assistant',
      audioRemote: 'Audio Remote Broadcast',
      qrGenerator: 'QR Code Generator',
      settings: 'Settings',
      signedInAs: 'Signed in as',
      role: 'Role',
      logout: 'Sign Out',
      backToLaunchpad: 'Home Launchpad',
      navigationMenu: 'System Navigation',
    },
    roles: {
      admin: 'Administrator',
      executive: 'Executive',
      teacher: 'Teacher',
      academicStaff: 'Academic Staff',
      supportStaff: 'Support Staff',
      cashier: 'Cashier / Finance Staff',
      staff: 'Staff',
    },
    home: {
      greetingMorning: 'Good morning',
      greetingAfternoon: 'Good afternoon',
      greetingEvening: 'Good evening',
      launchpadTitle: 'School Administration Portal',
      launchpadSubtitle: 'Effortlessly access all Somkidvittaya School administrative services and tools',
      searchPlaceholder: 'Search modules or tools...',
      noResults: 'No matching modules found',
      quickStats: 'Overview Statistics',
    },
    login: {
      welcomeTitle: 'Welcome to SV Portal',
      welcomeSubtitle: 'Sign in to access your official school management portal',
      googleLogin: 'Continue with Official Google Account',
      email: 'Email Address',
      emailPlaceholder: 'Official school email (@somkidvittaya.ac.th)',
      password: 'Password',
      passwordPlaceholder: 'Your password',
      loginButton: 'Sign In',
      schoolFooter: 'Somkidvittaya School (Somkidvittaya学校)',
      invalidDomain: 'Only official school accounts (@somkidvittaya.ac.th) are authorized',
      authFailed: 'Authentication failed. Please verify credentials and try again.',
      invalidCredentials: 'Invalid email address or password',
    },
    dashboard: {
      title: 'Financial & Operational Dashboard',
      subtitle: 'Daily summary of tuition fees, co-op shop revenue, and wallet top-ups',
      totalReceived: 'Total Revenue Received',
      tuitionFees: 'Tuition & Fees',
      coopShop: 'Co-op Store',
      walletTopup: 'Student Wallet Top-up',
      syncStatus: 'Data Sync Queue Status',
      pending: 'Pending Sync',
      processing: 'Processing',
      completed: 'Completed',
      failed: 'Failed',
      websiteOverview: 'Website Overview',
      newsArticles: 'News Articles',
      photoAlbums: 'Photo Albums',
      personnel: 'Personnel',
      today: 'Today',
      yesterday: 'Yesterday',
      updated: 'Updated',
      items: 'items',
      dateSummaryPrefix: 'Summary of tuition, co-op shop, and wallet top-ups as of',
    },
    fees: {
      title: 'Tuition & Fee Collection',
      subtitle: 'Complete student tuition collection, invoice settlement, and official receipts',
      step1: 'Search',
      step2: 'Select Fees',
      step3: 'Payment',
      step4: 'Completed',
      searchStudentPlaceholder: 'Student ID or Student Name...',
      searchTitle: 'Search Student',
      searchHint: 'Enter student ID or name to start fee collection',
      changeStudent: 'Change Student',
      noUnpaid: 'No Outstanding Fees',
      noUnpaidHint: 'This student has settled all current fee obligations',
      unpaidList: 'Outstanding Fee Invoices',
      dueDate: 'Due Date',
      overdue: 'Overdue',
      selectedCount: 'Selected',
      totalDue: 'Total Amount Due',
      proceedToPayment: 'Proceed to Payment',
      selectMethod: 'Select Payment Method',
      paymentMethod: 'Payment Method',
      cash: 'Cash',
      transfer: 'Bank Transfer',
      qrScan: 'Scan QR Code',
      qrScanHint: 'Parent scans the QR code above to complete payment',
      schoolAccount: 'School Bank Account',
      accountName: 'Account Name: Somkidvittaya School',
      copyAccount: 'Copy',
      copied: 'Account number copied',
      confirmPayment: 'Confirm Payment',
      paymentSuccess: 'Payment Successful',
      receiptNumber: 'Receipt No.',
      printReceipt: 'Print Receipt',
      newTransaction: 'New Transaction',
      nextStudent: 'Next Student',
      invoiceItems: 'Fee Invoices',
      amountToPay: 'Amount Due',
      slipNotice: 'Official School Payment Receipt',
    },
    shop: {
      title: 'Co-op Store Cashier (POS)',
      cart: 'Shopping Cart',
      emptyCart: 'Cart is currently empty',
      emptyCartHint: 'Scan a barcode or tap products from the catalog to add items',
      clearCart: 'Clear Cart',
      scanOrSearch: 'Search products or scan barcode...',
      readyToScan: 'Ready to scan barcode',
      notFound: 'No matching products found',
      checkout: 'Checkout',
      confirmPayment: 'Confirm Payment',
      amountDue: 'Total Amount Due',
      selectPaymentMethod: 'Select Payment Method',
      cashReceived: 'Cash Received (THB)',
      exactCash: 'Exact Amount',
      change: 'Change Due',
      insufficientCash: 'Insufficient cash received',
      studentWallet: 'Student Wallet',
      receipt: 'Official Receipt',
      itemCount: 'items',
      catalog: 'Product Catalog',
      offlineNotice: 'Offline — Data will automatically sync once connection is restored',
      totalAmount: 'Total Amount',
      printSlip: 'Print Slip',
      refCode: 'Ref Code',
      item: 'Item',
      quantity: 'Qty',
      price: 'Price',
      totalNet: 'Total Net',
      walletInfo: 'Wallet Details',
      tapOrScanStudentCard: 'Tap student card or scan barcode',
      changeCard: 'Change card / Switch account',
      dailyUsage: 'Daily Spending Limit',
    },
    products: {
      title: 'Inventory & Product Management',
      subtitle: 'Manage items, pricing, barcodes, and real-time inventory counts',
      addProduct: 'Add New Product',
      hideForm: 'Hide Form',
      totalProducts: 'Total Products',
      lowStockAlert: 'Low Stock Alert (< 10)',
      stockValue: 'Total Inventory Value',
      productName: 'Product Name',
      price: 'Price (THB)',
      stock: 'Stock Quantity',
      barcode: 'Barcode',
      category: 'Category',
      inStock: 'In Stock',
      outOfStock: 'Out of Stock',
      saveProduct: 'Save Product',
    },
    wallet: {
      topupTitle: 'Student Wallet Top-up',
      servicePoint: 'Service Point Top-up Station',
      manageTitle: 'Student Wallet Management',
      manageSubtitle: 'Monitor account balances, configure daily limits, and link NFC smart cards',
      tapCard: 'Tap Student Card',
      tapCardOrManual: 'Or enter student ID manually',
      currentBalance: 'Current Balance',
      dailyLimit: 'Daily Spending Limit',
      unlimited: 'Unlimited',
      spentToday: 'Spent Today',
      linkCard: 'Link NFC Card',
      hasCard: 'Card Linked',
      noCard: 'No Card',
      lowBalance: 'Low Balance',
      searchPlaceholder: 'Search by Student ID or Name...',
    },
    students: {
      title: 'Student Information Registry',
      subtitle: 'Maintain student records, enrollment status, and classroom assignments',
      studentId: 'Student ID',
      studentName: 'Student Name',
      grade: 'Grade Level',
      classroom: 'Classroom',
      promote: 'Promote Grade',
      addStudent: 'Add Student',
      allGrades: 'All Grade Levels',
    },
    kpi: {
      title: 'Staff Performance Evaluation (KPI)',
      subtitle: 'Self-assessment, supervisory review, and performance analytics',
      selfEvaluation: 'Self Assessment',
      supervisorEvaluation: 'Committee Review',
      analytics: 'Analytics & Reporting',
      totalScore: 'Total Score',
      evaluationPeriod: 'Evaluation Period',
      draft: 'Draft',
      submitted: 'Submitted',
      evaluated: 'Evaluated',
      confidentialNotice: 'Evaluation records are strictly confidential with anonymous evaluator identity',
    },
    forms: {
      title: 'SV-Forms Builder',
      subtitle: 'Online school form creation and automated response analytics',
      createForm: 'Create New Form',
      responses: 'Form Responses',
      formTemplates: 'Form Templates',
      nongFahAi: 'Nong Fah AI Assistant',
    },
  },
};

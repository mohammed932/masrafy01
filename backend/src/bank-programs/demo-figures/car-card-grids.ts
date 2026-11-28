/**
 * The seeded car programmes on the car pricing card's axes (v37.0.0) — deposit, brand, fuel, the
 * brand's category. Generated once from the live rows by `scripts/gen-car-card-grids.ts` through
 * the admin card's own conversion, so each reads back on the card exactly; hand-edited from now on.
 */
import type { FactGridDto } from '../dto/sub-configs/fact-grid.dto';

export interface CarCardGrids {
  rateByFact?: FactGridDto;
  maxMonthsByFact?: FactGridDto;
  carInsuranceRateByFact?: FactGridDto;
  interestFreeYearsByFact?: FactGridDto;
  maxVehicleAgeYearsByFact?: FactGridDto;
}

export const CAR_PRICING_DEMO: CarCardGrids = {
  "rateByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "10",
            "toExclusive": "20"
          },
          null,
          null,
          null
        ],
        "value": "20"
      },
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "18"
      },
      {
        "keys": [
          {
            "fromInclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "15"
      },
      {
        "keys": [
          {
            "fromInclusive": "10",
            "toExclusive": "20"
          },
          {
            "key": "bmw"
          },
          null,
          null
        ],
        "value": "9"
      },
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "50"
          },
          {
            "key": "bmw"
          },
          null,
          null
        ],
        "value": "9"
      },
      {
        "keys": [
          {
            "fromInclusive": "50"
          },
          {
            "key": "bmw"
          },
          null,
          null
        ],
        "value": "9"
      }
    ],
    "onNoMatch": "reject"
  },
  "maxMonthsByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "10",
            "toExclusive": "20"
          },
          null,
          {
            "key": "electric"
          },
          null
        ],
        "value": "60"
      },
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "50"
          },
          null,
          {
            "key": "electric"
          },
          null
        ],
        "value": "60"
      },
      {
        "keys": [
          {
            "fromInclusive": "50"
          },
          null,
          {
            "key": "electric"
          },
          null
        ],
        "value": "60"
      },
      {
        "keys": [
          {
            "fromInclusive": "10",
            "toExclusive": "20"
          },
          null,
          null,
          {
            "key": "european"
          }
        ],
        "value": "84"
      },
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "50"
          },
          null,
          null,
          {
            "key": "european"
          }
        ],
        "value": "84"
      },
      {
        "keys": [
          {
            "fromInclusive": "50"
          },
          null,
          null,
          {
            "key": "european"
          }
        ],
        "value": "84"
      }
    ],
    "onNoMatch": "useFallback"
  },
  "interestFreeYearsByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "2"
      }
    ],
    "onNoMatch": "useFallback"
  }
};

export const SCB_CARD: CarCardGrids = {
  "rateByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          null,
          null,
          null
        ],
        "value": "10"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          null,
          null
        ],
        "value": "9"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "8"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          null,
          null
        ],
        "value": "7"
      },
      {
        "keys": [
          {
            "fromInclusive": "60"
          },
          null,
          null,
          null
        ],
        "value": "6"
      },
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "12"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "11"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "10"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "9"
      },
      {
        "keys": [
          {
            "fromInclusive": "60"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "8"
      },
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          null,
          {
            "key": "electric"
          },
          null
        ],
        "value": "9"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          {
            "key": "electric"
          },
          null
        ],
        "value": "8"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          {
            "key": "electric"
          },
          null
        ],
        "value": "7"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          {
            "key": "electric"
          },
          null
        ],
        "value": "6"
      },
      {
        "keys": [
          {
            "fromInclusive": "60"
          },
          null,
          {
            "key": "electric"
          },
          null
        ],
        "value": "5"
      }
    ],
    "onNoMatch": "reject"
  },
  "maxMonthsByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          null,
          null,
          null
        ],
        "value": "60"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          null,
          null
        ],
        "value": "72"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "84"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          null,
          null
        ],
        "value": "84"
      },
      {
        "keys": [
          {
            "fromInclusive": "60"
          },
          null,
          null,
          null
        ],
        "value": "84"
      }
    ],
    "onNoMatch": "useFallback"
  },
  "carInsuranceRateByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          null,
          null,
          null
        ],
        "value": "1"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          null,
          null
        ],
        "value": "1"
      }
    ],
    "onNoMatch": "useFallback"
  }
};

export const NATIONAL: CarCardGrids = {
  "rateByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "10",
            "toExclusive": "20"
          },
          null,
          null,
          null
        ],
        "value": "11"
      },
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          null,
          null,
          null
        ],
        "value": "10"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          null,
          null
        ],
        "value": "9"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "8"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          null,
          null
        ],
        "value": "7"
      },
      {
        "keys": [
          {
            "fromInclusive": "60"
          },
          null,
          null,
          null
        ],
        "value": "6"
      },
      {
        "keys": [
          {
            "fromInclusive": "10",
            "toExclusive": "20"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "13"
      },
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "12"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "11"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "10"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "9"
      },
      {
        "keys": [
          {
            "fromInclusive": "60"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "8"
      },
      {
        "keys": [
          {
            "fromInclusive": "10",
            "toExclusive": "20"
          },
          null,
          {
            "key": "electric"
          },
          null
        ],
        "value": "10"
      },
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          null,
          {
            "key": "electric"
          },
          null
        ],
        "value": "9"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          {
            "key": "electric"
          },
          null
        ],
        "value": "8"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          {
            "key": "electric"
          },
          null
        ],
        "value": "7"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          {
            "key": "electric"
          },
          null
        ],
        "value": "6"
      },
      {
        "keys": [
          {
            "fromInclusive": "60"
          },
          null,
          {
            "key": "electric"
          },
          null
        ],
        "value": "5"
      }
    ],
    "onNoMatch": "reject"
  },
  "maxMonthsByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "10",
            "toExclusive": "20"
          },
          null,
          null,
          null
        ],
        "value": "60"
      },
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          null,
          null,
          null
        ],
        "value": "60"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          null,
          null
        ],
        "value": "72"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "84"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          null,
          null
        ],
        "value": "84"
      },
      {
        "keys": [
          {
            "fromInclusive": "60"
          },
          null,
          null,
          null
        ],
        "value": "84"
      }
    ],
    "onNoMatch": "useFallback"
  },
  "carInsuranceRateByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "30"
          },
          null,
          null,
          null
        ],
        "value": "1"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          null,
          null
        ],
        "value": "1"
      }
    ],
    "onNoMatch": "useFallback"
  }
};

export const ADIB_USED: CarCardGrids = {
  "rateByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          null,
          null
        ],
        "value": "14.96"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "13.46"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          null,
          null
        ],
        "value": "12.97"
      },
      {
        "keys": [
          {
            "fromInclusive": "60"
          },
          null,
          null,
          null
        ],
        "value": "12.19"
      }
    ],
    "onNoMatch": "reject"
  },
  "maxVehicleAgeYearsByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          null,
          null
        ],
        "value": "10"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "10"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          null,
          null
        ],
        "value": "10"
      },
      {
        "keys": [
          {
            "fromInclusive": "60"
          },
          null,
          null,
          null
        ],
        "value": "10"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          null,
          {
            "key": "japanese"
          }
        ],
        "value": "11"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          {
            "key": "japanese"
          }
        ],
        "value": "11"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          null,
          {
            "key": "japanese"
          }
        ],
        "value": "11"
      },
      {
        "keys": [
          {
            "fromInclusive": "60"
          },
          null,
          null,
          {
            "key": "japanese"
          }
        ],
        "value": "11"
      },
      {
        "keys": [
          {
            "fromInclusive": "30",
            "toExclusive": "40"
          },
          null,
          null,
          {
            "key": "american"
          }
        ],
        "value": "11"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          {
            "key": "american"
          }
        ],
        "value": "11"
      },
      {
        "keys": [
          {
            "fromInclusive": "50",
            "toExclusive": "60"
          },
          null,
          null,
          {
            "key": "american"
          }
        ],
        "value": "11"
      },
      {
        "keys": [
          {
            "fromInclusive": "60"
          },
          null,
          null,
          {
            "key": "american"
          }
        ],
        "value": "11"
      }
    ],
    "onNoMatch": "useFallback"
  }
};

export const CAE_NEW: CarCardGrids = {
  "rateByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "40"
          },
          null,
          null,
          null
        ],
        "value": "19"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "19"
      },
      {
        "keys": [
          {
            "fromInclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "19"
      }
    ],
    "onNoMatch": "reject"
  },
  "maxMonthsByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "20",
            "toExclusive": "40"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "60"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "60"
      },
      {
        "keys": [
          {
            "fromInclusive": "50"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "60"
      }
    ],
    "onNoMatch": "useFallback"
  }
};

export const CAE_USED: CarCardGrids = {
  "rateByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "40"
          },
          null,
          null,
          null
        ],
        "value": "19"
      }
    ],
    "onNoMatch": "reject"
  },
  "maxMonthsByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "40"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "60"
      }
    ],
    "onNoMatch": "useFallback"
  },
  "maxVehicleAgeYearsByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "40"
          },
          null,
          null,
          null
        ],
        "value": "8"
      },
      {
        "keys": [
          {
            "fromInclusive": "40"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "5"
      }
    ],
    "onNoMatch": "useFallback"
  }
};

export const CAE_EV: CarCardGrids = {
  "rateByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "35",
            "toExclusive": "40"
          },
          null,
          null,
          null
        ],
        "value": "19"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "19"
      },
      {
        "keys": [
          {
            "fromInclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "19"
      }
    ],
    "onNoMatch": "reject"
  },
  "maxMonthsByFact": {
    "axes": [
      {
        "factKey": "car_down_payment_percent"
      },
      {
        "factKey": "what_brand_is_the_car"
      },
      {
        "factKey": "car_fuel_type"
      },
      {
        "factKey": "what_brand_is_the_car",
        "via": "parentClass"
      }
    ],
    "cells": [
      {
        "keys": [
          {
            "fromInclusive": "35",
            "toExclusive": "40"
          },
          null,
          null,
          null
        ],
        "value": "84"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "84"
      },
      {
        "keys": [
          {
            "fromInclusive": "50"
          },
          null,
          null,
          null
        ],
        "value": "84"
      },
      {
        "keys": [
          {
            "fromInclusive": "35",
            "toExclusive": "40"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "60"
      },
      {
        "keys": [
          {
            "fromInclusive": "40",
            "toExclusive": "50"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "60"
      },
      {
        "keys": [
          {
            "fromInclusive": "50"
          },
          null,
          null,
          {
            "key": "chinese"
          }
        ],
        "value": "60"
      }
    ],
    "onNoMatch": "useFallback"
  }
};

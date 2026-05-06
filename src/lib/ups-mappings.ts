
/**
 * UPS specific country codes mapping.
 * Format: IATA/ISO Code -> UPS Code
 * Data sourced from /tempdata.txt
 */
export const UPS_COUNTRY_MAP: Record<string, string> = {
  "AF": "AF", // Afghanistan
  "AX": "AX", // Aland Islands
  "AL": "AL", // Albania
  "DZ": "DZ", // Algeria
  "AS": "AS", // American Samoa
  "AD": "AD", // Andorra
  "AO": "AO", // Angola
  "AI": "AI", // Anguilla
  "AG": "AG", // Antigua and Barbuda
  "AR": "AR", // Argentina
  "AM": "AM", // Armenia
  "AW": "AW", // Aruba
  "AU": "AU", // Australia
  "AT": "AT", // Austria
  "AZ": "AZ", // Azerbaijan
  "BS": "BS", // Bahamas
  "BH": "BH", // Bahrain
  "BD": "BD", // Bangladesh
  "BB": "BB", // Barbados
  "BY": "BY", // Belarus
  "BE": "BE", // Belgium
  "BZ": "BZ", // Belize
  "BJ": "BJ", // Benin
  "BM": "BM", // Bermuda
  "BT": "BT", // Bhutan
  "BO": "BO", // Bolivia
  "BQ": "BQ", // Bonaire, St. Eustatius, Saba
  "BA": "BA", // Bosnia
  "BW": "BW", // Botswana
  "BR": "BR", // Brazil
  "VG": "VG", // British Virgin Islands
  "BN": "BN", // Brunei
  "BG": "BG", // Bulgaria
  "BF": "BF", // Burkina Faso
  "BI": "BI", // Burundi
  "KH": "KH", // Cambodia
  "CM": "CM", // Cameroon
  "CA": "CA", // Canada
  "CV": "CV", // Cape Verde Island
  "KY": "KY", // Cayman Islands
  "CF": "CF", // Central African Republic
  "XC": "XC", // Ceuta
  "TD": "TD", // Chad
  "CL": "CL", // Chile
  "CN": "CN", // China
  "CO": "CO", // Colombia
  "KM": "KM", // Comoros
  "CG": "CG", // Congo
  "CD": "CD", // Congo, Democratic Republic
  "CK": "CK", // Cook Islands
  "CR": "CR", // Costa Rica
  "HR": "HR", // Croatia
  "CU": "CU", // Cuba
  "CW": "CW", // Curacao
  "CY": "CY", // Cyprus
  "CZ": "CZ", // Czech Republic
  "DK": "DK", // Denmark
  "DJ": "DJ", // Djibouti
  "DM": "DM", // Dominica
  "DO": "DO", // Dominican Republic
  "TL": "TL", // East Timor
  "EC": "EC", // Ecuador
  "EG": "EG", // Egypt
  "SV": "SV", // El Salvador
  "GQ": "GQ", // Equatorial Guinea
  "ER": "ER", // Eritrea
  "EE": "EE", // Estonia
  "ET": "ET", // Ethiopia
  "FO": "FO", // Faroe Islands
  "FJ": "FJ", // Fiji
  "FI": "FI", // Finland
  "FR": "FR", // France
  "GF": "GF", // French Guiana
  "PF": "PF", // French Polynesia
  "GA": "GA", // Gabon
  "GM": "GM", // Gambia
  "GE": "GE", // Georgia
  "DE": "DE", // Germany
  "GH": "GH", // Ghana
  "GI": "GI", // Gibraltar
  "GR": "GR", // Greece
  "GL": "GL", // Greenland
  "GD": "GD", // Grenada
  "GP": "GP", // Guadeloupe
  "GU": "GU", // Guam
  "GT": "GT", // Guatemala
  "GG": "GG", // Guernsey
  "GN": "GN", // Guinea
  "GW": "GW", // Guinea-Bissau
  "GY": "GY", // Guyana
  "HT": "HT", // Haiti
  "HN": "HN", // Honduras
  "HK": "HK", // Hong Kong
  "HU": "HU", // Hungary
  "IS": "IS", // Iceland
  "IN": "IN", // India
  "ID": "ID", // Indonesia
  "IQ": "IQ", // Iraq
  "IE": "IE", // Ireland, Republic of
  "IL": "IL", // Israel
  "IT": "IT", // Italy
  "CI": "CI", // Ivory Coast
  "JM": "JM", // Jamaica
  "JP": "JP", // Japan
  "JE": "JE", // Jersey
  "JO": "JO", // Jordan
  "KZ": "KZ", // Kazakhstan
  "KE": "KE", // Kenya
  "KI": "KI", // Kiribati
  "KR": "KR", // Korea, South
  "KV": "KV", // Kosovo
  "KW": "KW", // Kuwait
  "KG": "KG", // Kyrgyzstan
  "LA": "LA", // Laos
  "LV": "LV", // Latvia
  "LB": "LB", // Lebanon
  "LS": "LS", // Lesotho
  "LR": "LR", // Liberia
  "LY": "LY", // Libya
  "LI": "LI", // Liechtenstein
  "LT": "LT", // Lithuania
  "LU": "LU", // Luxembourg
  "MO": "MO", // Macau
  "MK": "MK", // Macedonia
  "MG": "MG", // Madagascar
  "MW": "MW", // Malawi
  "MY": "MY", // Malaysia
  "MV": "MV", // Maldives
  "ML": "ML", // Mali
  "MT": "MT", // Malta
  "MH": "MH", // Marshall Islands
  "MQ": "MQ", // Martinique
  "MR": "MR", // Mauritania
  "MU": "MU", // Mauritius
  "YT": "YT", // Mayotte
  "MX": "MX", // Mexico
  "FM": "FM", // Micronesia
  "MD": "MD", // Moldova
  "MC": "MC", // Monaco
  "MN": "MN", // Mongolia
  "ME": "ME", // Montenegro
  "MS": "MS", // Montserrat
  "MA": "MA", // Morocco
  "MZ": "MZ", // Mozambique
  "NA": "NA", // Namibia
  "NP": "NP", // Nepal
  "NL": "NL", // Netherlands
  "NC": "NC", // New Caledonia
  "NZ": "NZ", // New Zealand
  "NI": "NI", // Nicaragua
  "NE": "NE", // Niger
  "NG": "NG", // Nigeria
  "NF": "NF", // Norfolk Island
  "MP": "MP", // Northern Mariana Islands
  "NO": "NO", // Norway
  "OM": "OM", // Oman
  "PK": "PK", // Pakistan
  "PW": "PW", // Palau
  "PA": "PA", // Panama
  "PG": "PG", // Papua New Guinea
  "PY": "PY", // Paraguay
  "PE": "PE", // Peru
  "PH": "PH", // Philippines
  "PL": "PL", // Poland
  "PT": "PT", // Portugal
  "PR": "PR", // Puerto Rico
  "QA": "QA", // Qatar
  "RE": "RE", // Reunion
  "RO": "RO", // Romania
  "RU": "RU", // Russia
  "RW": "RW", // Rwanda
  "WS": "WS", // Samoa
  "SM": "SM", // San Marino
  "ST": "ST", // Sao Tome and Principe
  "SA": "SA", // Saudi Arabia
  "SN": "SN", // Senegal
  "RS": "RS", // Serbia
  "SC": "SC", // Seychelles
  "SL": "SL", // Sierra Leone
  "SG": "SG", // Singapore
  "SK": "SK", // Slovakia
  "SI": "SI", // Slovenia
  "SB": "SB", // Solomon Islands
  "ZA": "ZA", // South Africa
  "ES": "ES", // Spain
  "LK": "LK", // Sri Lanka
  "BL": "BL", // St. Barthelemy
  "KN": "KN", // St. Kitts and Nevis
  "LC": "LC", // St. Lucia
  "SX": "SX", // St. Maarten
  "VC": "VC", // St. Vincent
  "SR": "SR", // Suriname
  "SZ": "SZ", // Swaziland
  "SE": "SE", // Sweden
  "CH": "CH", // Switzerland
  "TW": "TW", // Taiwan
  "TJ": "TJ", // Tajikistan
  "TZ": "TZ", // Tanzania
  "TH": "TH", // Thailand
  "TG": "TG", // Togo
  "TO": "TO", // Tonga
  "TT": "TT", // Trinidad and Tobago
  "TN": "TN", // Tunisia
  "TR": "TR", // Turkey
  "TM": "TM", // Turkmenistan
  "TC": "TC", // Turks and Caicos
  "TV": "TV", // Tuvalu
  "UG": "UG", // Uganda
  "UA": "UA", // Ukraine
  "AE": "AE", // United Arab Emirates
  "GB": "GB", // United Kingdom
  "US": "US", // United States
  "UY": "UY", // Uruguay
  "UZ": "UZ", // Uzbekistan
  "VU": "VU", // Vanuatu
  "VA": "VA", // Vatican City
  "VE": "VE", // Venezuela
  "VN": "VN", // Vietnam
  
  // Special UPS Codes
  "A2": "A2", // Azores (PT)
  "IC": "IC", // Canary Islands (ES)
  "M3": "M3", // Madeira (PT)
  "S1": "S1", // Saba (BQ)
  "E2": "E2", // St. Eustatius (BQ)
  "C3": "C3", // St. Croix (VI)
  "UV": "UV", // St. John (VI)
  "VL": "VL", // St. Thomas (VI)
  "RT": "RT", // Rota (MP)
  "TI": "TI", // Tinian (MP)
  "SP": "SP", // Saipan (MP)
  "KO": "KO", // Kosrae (FM)
  "PO": "PO", // Ponape (FM)
  "TU": "TU", // Truk (FM)
  
  // UK Variations (mapping to UPS specific codes)
  "EN": "EN", // England
  "NB": "NB", // Northern Ireland
  "SF": "SF", // Scotland
  "GG_UPS": "GG", // Guernsey (has its own code already but listed in file)
  "JE_UPS": "JE", // Jersey
};

/**
 * Mapping of Country Names to UPS Codes
 */
export const UPS_NAME_MAP: Record<string, string> = {
  "AZORES": "A2",
  "CANARY ISLANDS": "IC",
  "MADEIRA": "M3",
  "ENGLAND": "EN",
  "NORTHERN IRELAND": "NB",
  "SCOTLAND": "SF",
  "UNITED KINGDOM": "GB",
  "IRELAND, REPUBLIC OF": "IE",
  "NETHERLANDS": "NL",
  "HOLLAND": "HO", // File says Holland - HO - NL
  "CHINA, PEOPLES REPUBLIC OF": "CN",
};

/**
 * Gets the UPS-specific country code.
 */
export function getUpsCode(isoCode: string | undefined): string {
  if (!isoCode) return 'GB';
  const clean = isoCode.trim().toUpperCase();
  
  // Direct territorial mapping for UPS
  if (clean === 'XI') return 'NB'; // Northern Ireland for UPS
  
  return UPS_COUNTRY_MAP[clean] || clean || 'GB';
}

/**
 * Bibliography for the TRANSEC taxonomy dataset.
 *
 * Every `doi` here was resolved against Crossref; entries without a DOI are
 * standards or government issuances that are not DOI-registered, and carry the
 * canonical publisher/issuer URL instead.
 */

import type { Reference } from './types';

export const REFERENCES: Reference[] = [
  // ——— Information-theoretic foundations ————————————————————————
  {
    id: 'shannon1948',
    authors: 'C. E. Shannon',
    title: 'A Mathematical Theory of Communication',
    venue: 'Bell System Technical Journal, vol. 27, no. 3, pp. 379–423',
    year: 1948,
    doi: '10.1002/j.1538-7305.1948.tb01338.x',
    tags: ['foundation'],
  },
  {
    id: 'shannon1949',
    authors: 'C. E. Shannon',
    title: 'Communication Theory of Secrecy Systems',
    venue: 'Bell System Technical Journal, vol. 28, no. 4, pp. 656–715',
    year: 1949,
    doi: '10.1002/j.1538-7305.1949.tb00928.x',
    tags: ['foundation'],
  },
  {
    id: 'wyner1975',
    authors: 'A. D. Wyner',
    title: 'The Wire-Tap Channel',
    venue: 'Bell System Technical Journal, vol. 54, no. 8, pp. 1355–1387',
    year: 1975,
    doi: '10.1002/j.1538-7305.1975.tb02040.x',
    tags: ['lpe', 'foundation'],
  },

  // ——— Objective-specific literature ————————————————————————————
  {
    id: 'bash2013',
    authors: 'B. A. Bash, D. Goeckel, D. Towsley',
    title: 'Limits of Reliable Communication with Low Probability of Detection on AWGN Channels',
    venue: 'IEEE Journal on Selected Areas in Communications, vol. 31, no. 9, pp. 1921–1930',
    year: 2013,
    doi: '10.1109/JSAC.2013.130923',
    tags: ['lpd'],
  },
  {
    id: 'goel2008',
    authors: 'S. Goel, R. Negi',
    title: 'Guaranteeing Secrecy using Artificial Noise',
    venue: 'IEEE Transactions on Wireless Communications, vol. 7, no. 6, pp. 2180–2189',
    year: 2008,
    doi: '10.1109/TWC.2008.060848',
    tags: ['lpe'],
  },
  {
    id: 'pirayesh2022',
    authors: 'H. Pirayesh, H. Zeng',
    title: 'Jamming Attacks and Anti-Jamming Strategies in Wireless Networks: A Comprehensive Survey',
    venue: 'IEEE Communications Surveys & Tutorials, vol. 24, no. 2, pp. 767–809',
    year: 2022,
    doi: '10.1109/COMST.2022.3159185',
    tags: ['aj'],
  },
  {
    id: 'chen2023',
    authors: 'X. Chen, J. An, Z. Xiong, C. Xing, N. Zhao, F. R. Yu, A. Nallanathan',
    title: 'Covert Communications: A Comprehensive Survey',
    venue: 'IEEE Communications Surveys & Tutorials, vol. 25, no. 2, pp. 1173–1198',
    year: 2023,
    doi: '10.1109/COMST.2023.3263921',
    tags: ['lpd', 'tfs'],
  },

  // ——— Band physics and deployment context ——————————————————————
  {
    id: 'ma2018',
    authors:
      'J. Ma, R. Shrestha, J. Adelberg, C.-Y. Yeh, Z. Hossain, E. Knightly, J. M. Jornet, D. M. Mittleman',
    title: 'Security and eavesdropping in terahertz wireless links',
    venue: 'Nature, vol. 563, no. 7729, pp. 89–93',
    year: 2018,
    doi: '10.1038/s41586-018-0609-x',
    tags: ['lpd', 'band-context'],
  },
  {
    id: 'rappaport2019',
    authors:
      'T. S. Rappaport, Y. Xing, O. Kanhere, S. Ju, A. Madanayake, S. Mandal, A. Alkhateeb, G. C. Trichopoulos',
    title:
      'Wireless Communications and Applications Above 100 GHz: Opportunities and Challenges for 6G and Beyond',
    venue: 'IEEE Access, vol. 7, pp. 78729–78757',
    year: 2019,
    doi: '10.1109/ACCESS.2019.2921522',
    tags: ['band-context'],
  },
  {
    id: 'tedeschi2022',
    authors: 'P. Tedeschi, S. Sciancalepore, R. Di Pietro',
    title:
      'Satellite-based communications security: A survey of threats, solutions, and research challenges',
    venue: 'Computer Networks, vol. 216, art. 109246',
    year: 2022,
    doi: '10.1016/j.comnet.2022.109246',
    tags: ['band-context', 'aj'],
  },
  {
    id: 'salim2025',
    authors: 'S. Salim, N. Moustafa, M. Reisslein',
    title:
      'Cybersecurity of Satellite Communications Systems: A Comprehensive Survey of the Space, Ground, and Links Segments',
    venue: 'IEEE Communications Surveys & Tutorials, vol. 27, no. 1, pp. 372–425',
    year: 2025,
    doi: '10.1109/COMST.2024.3408277',
    tags: ['band-context'],
  },
  {
    id: 'pavur2020',
    authors: 'J. Pavur, D. Moser, M. Strohmeier, V. Lenders, I. Martinovic',
    title: 'A Tale of Sea and Sky: On the Security of Maritime VSAT Communications',
    venue: 'IEEE Symposium on Security and Privacy, pp. 1384–1400',
    year: 2020,
    doi: '10.1109/SP40000.2020.00056',
    tags: ['lpe', 'band-context'],
  },
  {
    id: 'zhang2025',
    authors: 'W. Zhang, A. Dai, K. Ryan, D. Levin, N. Heninger, A. Schulman',
    title: "Don't Look Up: There Are Sensitive Internal Links in the Clear on GEO Satellites",
    venue: 'ACM Conference on Computer and Communications Security (CCS)',
    year: 2025,
    doi: '10.1145/3719027.3765198',
    tags: ['lpe', 'band-context'],
  },
  {
    id: 'humphreys2023',
    authors: 'T. E. Humphreys, P. A. Iannucci, Z. M. Komodromos, A. M. Graff',
    title: 'Signal Structure of the Starlink Ku-Band Downlink',
    venue: 'IEEE Transactions on Aerospace and Electronic Systems, vol. 59, no. 5, pp. 6016–6030',
    year: 2023,
    doi: '10.1109/TAES.2023.3268610',
    tags: ['lpi', 'band-context'],
  },
  {
    id: 'kozhaya2025',
    authors: 'S. Kozhaya, J. Saroufim, Z. M. Kassas',
    title: 'Unveiling Starlink for PNT',
    venue: 'NAVIGATION: Journal of the Institute of Navigation, vol. 72, no. 1',
    year: 2025,
    doi: '10.33012/navi.685',
    tags: ['lpi', 'band-context'],
  },
  {
    id: 'koisser2024',
    authors: 'D. Koisser, R. Mitev, M. Chilese, A.-R. Sadeghi',
    title: "Don't Shoot the Messenger: Localization Prevention of Satellite Internet Users",
    venue: 'IEEE Symposium on Security and Privacy',
    year: 2024,
    url: 'https://arxiv.org/abs/2307.14879',
    tags: ['lpd', 'band-context'],
  },
  {
    id: 'yue2023',
    authors: 'P. Yue, J. An, J. Zhang, J. Ye, G. Pan, S. Wang, P. Xiao, L. Hanzo',
    title: 'Low Earth Orbit Satellite Security and Reliability: Issues, Solutions, and the Road Ahead',
    venue: 'IEEE Communications Surveys & Tutorials, vol. 25, no. 3, pp. 1604–1652',
    year: 2023,
    doi: '10.1109/COMST.2023.3296160',
    tags: ['aj', 'lpe', 'band-context'],
  },

  // ——— Standards, recommendations, government issuances ——————————
  {
    id: 'cnssi4009',
    authors: 'Committee on National Security Systems',
    title: 'CNSSI No. 4009, Committee on National Security Systems (CNSS) Glossary',
    venue: 'CNSS Instruction No. 4009, 2 March 2022',
    year: 2022,
    url: 'https://www.cnss.gov/CNSS/issuances/Instructions.cfm',
    tags: ['foundation', 'lpi'],
  },
  {
    id: 'iso18092',
    authors: 'ISO/IEC JTC 1/SC 6',
    title:
      'Information technology — Telecommunications and information exchange between systems — Near Field Communication — Interface and Protocol (NFCIP-1)',
    venue: 'ISO/IEC 18092:2013 (2nd ed.)',
    year: 2013,
    url: 'https://www.iso.org/standard/56692.html',
    tags: ['band-context'],
  },
  {
    id: 'bt-core-61',
    authors: 'Bluetooth SIG',
    title: 'Bluetooth Core Specification, Version 6.1',
    venue: 'Bluetooth SIG, adopted 6 May 2025',
    year: 2025,
    url: 'https://www.bluetooth.com/specifications/specs/core-specification-6-1/',
    tags: ['band-context'],
  },
  {
    id: 'ieee80211be',
    authors: 'IEEE 802.11 Working Group',
    title:
      'IEEE Standard for Information technology — Local and metropolitan area networks — Part 11: Wireless LAN Medium Access Control (MAC) and Physical Layer (PHY) Specifications Amendment 2: Enhancements for Extremely High Throughput (EHT)',
    venue: 'IEEE Std 802.11be-2024 (Wi-Fi 7)',
    year: 2024,
    doi: '10.1109/IEEESTD.2024.11090080',
    tags: ['band-context'],
  },
  {
    id: '3gpp-ts25211',
    authors: '3GPP TSG RAN WG1',
    title:
      'Physical channels and mapping of transport channels onto physical channels (FDD)',
    venue: '3GPP TS 25.211 (UTRA / 3G)',
    year: 1999,
    url: 'https://www.3gpp.org/dynareport/25211.htm',
    tags: ['band-context'],
  },
  {
    id: '3gpp-ts36211',
    authors: '3GPP TSG RAN WG1',
    title:
      'Evolved Universal Terrestrial Radio Access (E-UTRA); Physical channels and modulation',
    venue: '3GPP TS 36.211 (LTE / 4G)',
    year: 2007,
    url: 'https://www.3gpp.org/dynareport/36211.htm',
    tags: ['band-context'],
  },
  {
    id: '3gpp-ts38211',
    authors: '3GPP TSG RAN WG1',
    title: 'NR; Physical channels and modulation',
    venue: '3GPP TS 38.211 (5G NR)',
    year: 2018,
    url: 'https://www.3gpp.org/dynareport/38211.htm',
    tags: ['band-context'],
  },
  {
    id: 'etsi-dvbs2x',
    authors: 'ETSI / DVB Project',
    title:
      'Digital Video Broadcasting (DVB); Second generation framing structure, channel coding and modulation systems for Broadcasting, Interactive Services, News Gathering and other broadband satellite applications; Part 2: DVB-S2 Extensions (DVB-S2X)',
    venue: 'ETSI EN 302 307-2 V1.3.1 (2021-07)',
    year: 2021,
    url: 'https://www.etsi.org/deliver/etsi_en/302300_302399/30230702/01.03.01_60/en_30230702v010301p.pdf',
    tags: ['band-context'],
  },
  {
    id: 'itu-p676',
    authors: 'ITU Radiocommunication Sector',
    title: 'Attenuation by atmospheric gases and related effects',
    venue: 'Recommendation ITU-R P.676-12 (08/2019)',
    year: 2019,
    url: 'https://www.itu.int/rec/R-REC-P.676-12-201908-S/en',
    tags: ['band-context'],
  },
  {
    id: 'itu-m2160',
    authors: 'ITU Radiocommunication Sector',
    title:
      'Framework and overall objectives of the future development of IMT for 2030 and beyond',
    venue: 'Recommendation ITU-R M.2160-0 (11/2023)',
    year: 2023,
    url: 'https://www.itu.int/rec/R-REC-M.2160-0-202311-I/en',
    tags: ['band-context'],
  },
  {
    id: 'itu-m2541',
    authors: 'ITU Radiocommunication Sector',
    title: 'Technical feasibility of IMT in bands above 100 GHz',
    venue: 'Report ITU-R M.2541-0 (05/2024)',
    year: 2024,
    url: 'https://www.itu.int/pub/R-REP-M.2541',
    tags: ['band-context'],
  },
];

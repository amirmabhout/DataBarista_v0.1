import {
  IAgentRuntime,
  Memory,
  State,
  elizaLogger,
  HandlerCallback,
  ActionExample,
  type Action,
} from "@elizaos/core";
// @ts-ignore
import DKG from "dkg.js";
import { DkgClientConfig } from "../utils/types";
import { v4 as uuidv4 } from 'uuid';

let DkgClient: any = null;

// Define synthetic profiles directly in this file
const syntheticProfiles = [
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Experienced fitness influencer with tech background seeking AI/Web3 fitness projects",
            "datalatte:projectDescription": "Building a community of tech-savvy fitness enthusiasts and helping innovative fitness apps reach their target audience",
            "datalatte:challenge": "Finding innovative fitness tech projects that truly solve user problems",
            "datalatte:desiredConnections": "AI developers, Web3 founders, Fitness Tech",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/fittech",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "FitTech Influencer Network",
                "schema:description": "A network of fitness influencers specializing in promoting innovative fitness technology solutions",
                "datalatte:type": "marketing",
                "datalatte:projectDomain": "fitness",
                "datalatte:techStack": "social media, content creation, community building"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Alex FitTech",
            "datalatte:background": "Fitness influencer with 500k+ followers and previous experience in promoting health tech apps",
            "datalatte:knowledgeDomain": "Fitness Marketing",
            "datalatte:privateDetails": "Previously helped launch 3 successful fitness apps with over 100k downloads each",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_fittech_alex"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "DeFi Protocol Designer specializing in liquidity optimization",
            "datalatte:projectDescription": "Building next-gen AMM protocol with ML-powered liquidity management",
            "datalatte:challenge": "Finding ML experts who understand DeFi mechanics",
            "datalatte:desiredConnections": "ML Engineers, DeFi researchers, Quant developers",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/defi-ml",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "ML-AMM Protocol",
                "schema:description": "Machine Learning powered Automated Market Maker",
                "datalatte:type": "defi",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Solidity, Python, TensorFlow"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "David DeFi",
            "datalatte:background": "5 years in DeFi protocol development",
            "datalatte:knowledgeDomain": "DeFi, AMMs",
            "datalatte:privateDetails": "Previously led development at major DEX",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_defi_david"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Zero Knowledge Proof Researcher and Developer",
            "datalatte:projectDescription": "Building privacy-preserving DeFi applications",
            "datalatte:challenge": "Optimizing ZK proof generation for mobile devices",
            "datalatte:desiredConnections": "ZK researchers, Mobile developers, Cryptographers",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/zk-defi",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "ZK-DeFi Mobile",
                "schema:description": "Mobile-first private DeFi transactions",
                "datalatte:type": "privacy",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Rust, circom, React Native"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Zara ZK",
            "datalatte:background": "PhD in Cryptography, 3 years ZK development",
            "datalatte:knowledgeDomain": "Zero Knowledge Proofs",
            "datalatte:privateDetails": "Published research on efficient ZK circuits",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_zk_zara"
            }
        }
    },
    // Circles Network Trust Seekers (5 profiles)
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Community Artist Seeking Circles Network Trust Connection",
            "datalatte:projectDescription": "Creating digital art NFTs and seeking to participate in the Circles UBI ecosystem",
            "datalatte:challenge": "Finding trusted community members to vouch for me in the Circles network",
            "datalatte:desiredConnections": "Circles network members, Digital artists, Web3 community builders",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/circles-artist",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "ArtCircles Community",
                "schema:description": "Building an artist collective within the Circles UBI network",
                "datalatte:type": "community",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Circles UBI, NFTs, Community Building"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Maya Artist",
            "datalatte:background": "Digital artist with focus on community-driven art projects",
            "datalatte:knowledgeDomain": "Digital Art, Community Building",
            "datalatte:privateDetails": "Created several successful NFT collections, active in local artist communities",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_circles_maya"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Local Food Cooperative Organizer Seeking Circles Trust",
            "datalatte:projectDescription": "Integrating local food cooperative with Circles UBI for community resilience",
            "datalatte:challenge": "Building trust connections in Circles network for cooperative members",
            "datalatte:desiredConnections": "Circles network members, Cooperative organizers, Local economy experts",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/circles-food",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "FoodCircles Coop",
                "schema:description": "Local food cooperative powered by Circles UBI",
                "datalatte:type": "cooperative",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Circles UBI, Local Economy Tools"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Carlos Coop",
            "datalatte:background": "Food cooperative organizer with 5 years experience",
            "datalatte:knowledgeDomain": "Cooperative Management, Local Economies",
            "datalatte:privateDetails": "Built successful food cooperative with 200+ members",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_circles_carlos"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Sustainable Fashion Designer Seeking Circles Network Entry",
            "datalatte:projectDescription": "Creating sustainable fashion marketplace using Circles for transactions",
            "datalatte:challenge": "Establishing initial trust connections in Circles network",
            "datalatte:desiredConnections": "Circles network members, Sustainable fashion community, Web3 developers",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/circles-fashion",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "FashionCircles",
                "schema:description": "Sustainable fashion marketplace powered by Circles UBI",
                "datalatte:type": "marketplace",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Circles UBI, Sustainable Fashion"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Sophia Style",
            "datalatte:background": "Sustainable fashion designer and circular economy advocate",
            "datalatte:knowledgeDomain": "Sustainable Fashion, Circular Economy",
            "datalatte:privateDetails": "Launched successful sustainable fashion brand, seeking Web3 integration",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_circles_sophia"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Community Education Coordinator Seeking Circles Trust",
            "datalatte:projectDescription": "Developing education programs that integrate Circles UBI for student support",
            "datalatte:challenge": "Building trust network for educational community in Circles",
            "datalatte:desiredConnections": "Circles network members, Educators, EdTech developers",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/circles-edu",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "EduCircles",
                "schema:description": "Education support network powered by Circles UBI",
                "datalatte:type": "education",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Circles UBI, EdTech"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Elena Edu",
            "datalatte:background": "Education coordinator with focus on alternative learning systems",
            "datalatte:knowledgeDomain": "Education, Community Building",
            "datalatte:privateDetails": "Led successful community education programs, exploring Web3 integration",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_circles_elena"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Urban Farming Collective Seeking Circles Network Integration",
            "datalatte:projectDescription": "Creating urban farming network supported by Circles UBI",
            "datalatte:challenge": "Establishing trust connections for urban farmers in Circles",
            "datalatte:desiredConnections": "Circles network members, Urban farmers, Sustainability experts",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/circles-farm",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "FarmCircles",
                "schema:description": "Urban farming collective using Circles UBI",
                "datalatte:type": "agriculture",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Circles UBI, Urban Farming"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Raj Farmer",
            "datalatte:background": "Urban farming expert and community organizer",
            "datalatte:knowledgeDomain": "Urban Agriculture, Community Building",
            "datalatte:privateDetails": "Manages network of urban farms, exploring Web3 integration",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_circles_raj"
            }
        }
    },
    // Other Web3 Profiles (15 more diverse profiles)
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Layer 2 Scaling Solution Architect",
            "datalatte:projectDescription": "Developing optimistic rollup implementation with focus on gaming applications",
            "datalatte:challenge": "Optimizing proof generation and verification for gaming use cases",
            "datalatte:desiredConnections": "Game developers, L2 experts, Performance engineers",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/l2gaming",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "GameRoll L2",
                "schema:description": "Gaming-focused L2 scaling solution",
                "datalatte:type": "infrastructure",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Optimistic Rollups, Rust, Solidity"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Leo Layer2",
            "datalatte:background": "L2 scaling expert with gaming industry experience",
            "datalatte:knowledgeDomain": "Layer 2 Scaling, Gaming",
            "datalatte:privateDetails": "Previously built scaling solution handling 1M+ daily transactions",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_l2_leo"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Decentralized Identity Solutions Developer",
            "datalatte:projectDescription": "Building self-sovereign identity framework for Web3 applications",
            "datalatte:challenge": "Implementing privacy-preserving verification systems",
            "datalatte:desiredConnections": "Identity experts, Privacy researchers, UX designers",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/did",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "DID Framework",
                "schema:description": "Decentralized identity verification system",
                "datalatte:type": "identity",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "TypeScript, ZK-SNARKs, DIDs"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Ian Identity",
            "datalatte:background": "Identity management specialist, Web3 architect",
            "datalatte:knowledgeDomain": "Decentralized Identity",
            "datalatte:privateDetails": "Created identity solution used by 50k+ users",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_did_ian"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "ReFi Project Lead Seeking Technical Partners",
            "datalatte:projectDescription": "Developing carbon credit marketplace with on-chain verification",
            "datalatte:challenge": "Implementing reliable carbon credit verification on-chain",
            "datalatte:desiredConnections": "Environmental scientists, Smart contract developers, IoT experts",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/refi",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "CarbonChain",
                "schema:description": "Blockchain-based carbon credit trading platform",
                "datalatte:type": "refi",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Solidity, IoT Integration, React"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Rachel ReFi",
            "datalatte:background": "Environmental scientist with blockchain expertise",
            "datalatte:knowledgeDomain": "ReFi, Carbon Markets",
            "datalatte:privateDetails": "Led development of major carbon offset protocol",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_refi_rachel"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "NFT Gaming Infrastructure Developer",
            "datalatte:projectDescription": "Building cross-chain NFT gaming assets platform",
            "datalatte:challenge": "Scaling cross-chain asset transfers efficiently",
            "datalatte:desiredConnections": "Game designers, Bridge developers, Unity developers",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/nft-gaming",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "CrossChain Gaming Assets",
                "schema:description": "Unified gaming assets across multiple blockchains",
                "datalatte:type": "gaming",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Unity, Solidity, LayerZero"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Nina NFT",
            "datalatte:background": "Game developer turned Web3 infrastructure builder",
            "datalatte:knowledgeDomain": "Gaming NFTs",
            "datalatte:privateDetails": "Built NFT marketplace with 100k+ monthly users",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_nft_nina"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "DAO Governance Specialist and Tool Builder",
            "datalatte:projectDescription": "Developing DAO coordination and voting tools",
            "datalatte:challenge": "Improving voter participation and delegation",
            "datalatte:desiredConnections": "DAO operators, Governance researchers",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/dao-tools",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "DAO Toolkit",
                "schema:description": "Comprehensive DAO management and voting platform",
                "datalatte:type": "dao",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "TypeScript, Graph Protocol, Solidity"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Tom DAO",
            "datalatte:background": "Governance specialist and smart contract auditor",
            "datalatte:knowledgeDomain": "DAO Governance",
            "datalatte:privateDetails": "Advised 10+ major DAOs on governance",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_dao_tom"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "DeSci Protocol Developer for Research Data",
            "datalatte:projectDescription": "Creating decentralized platform for scientific data sharing",
            "datalatte:challenge": "Implementing proper data access controls and incentives",
            "datalatte:desiredConnections": "Research institutions, Data scientists, Web3 developers",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/desci",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "DeSci Data Share",
                "schema:description": "Decentralized scientific data sharing platform",
                "datalatte:type": "desci",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "IPFS, Solidity, Python"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Sam Science",
            "datalatte:background": "Bioinformatics researcher and Web3 developer",
            "datalatte:knowledgeDomain": "DeSci, Data Sharing",
            "datalatte:privateDetails": "Led development of genomics data platform",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_desci_sam"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Decentralized Music Platform Developer",
            "datalatte:projectDescription": "Building fair music distribution and royalty system on Web3",
            "datalatte:challenge": "Implementing transparent royalty distribution",
            "datalatte:desiredConnections": "Music industry experts, Smart contract developers",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/music",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "MusicChain",
                "schema:description": "Blockchain-based music streaming platform",
                "datalatte:type": "entertainment",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Solidity, Web3.js, Node.js"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Mike Music",
            "datalatte:background": "Music industry professional and blockchain developer",
            "datalatte:knowledgeDomain": "Music Industry, Web3",
            "datalatte:privateDetails": "Previously worked at major streaming service",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_music_mike"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Decentralized Insurance Protocol Developer",
            "datalatte:projectDescription": "Building parametric insurance solutions on blockchain",
            "datalatte:challenge": "Creating reliable oracle systems for insurance triggers",
            "datalatte:desiredConnections": "Insurance experts, Oracle developers, Risk analysts",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/insurance",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "InsureDAO",
                "schema:description": "Decentralized parametric insurance platform",
                "datalatte:type": "insurance",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Solidity, Chainlink, React"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Iris Insurance",
            "datalatte:background": "Insurance actuary turned Web3 developer",
            "datalatte:knowledgeDomain": "Insurance, DeFi",
            "datalatte:privateDetails": "Developed crop insurance protocol used by farmers",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_insurance_iris"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Decentralized AI Compute Network Developer",
            "datalatte:projectDescription": "Building distributed AI training platform",
            "datalatte:challenge": "Coordinating distributed compute resources efficiently",
            "datalatte:desiredConnections": "AI researchers, Distributed systems experts, Web3 devs",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/aicompute",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "AIChain",
                "schema:description": "Decentralized AI compute network",
                "datalatte:type": "ai",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "PyTorch, Solidity, IPFS"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Alan AI",
            "datalatte:background": "AI researcher and distributed systems expert",
            "datalatte:knowledgeDomain": "AI, Distributed Computing",
            "datalatte:privateDetails": "Built distributed training system for major AI lab",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_ai_alan"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Decentralized Social Media Protocol Developer",
            "datalatte:projectDescription": "Building censorship-resistant social platform",
            "datalatte:challenge": "Scaling content distribution while maintaining decentralization",
            "datalatte:desiredConnections": "P2P experts, Content creators, UI/UX designers",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/social",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "DecentSocial",
                "schema:description": "Decentralized social media protocol",
                "datalatte:type": "social",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "ActivityPub, IPFS, React"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Sally Social",
            "datalatte:background": "Social platform architect and P2P systems expert",
            "datalatte:knowledgeDomain": "Decentralized Social",
            "datalatte:privateDetails": "Built federated social network with 1M+ users",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_social_sally"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Decentralized Storage Protocol Engineer",
            "datalatte:projectDescription": "Developing incentivized storage network",
            "datalatte:challenge": "Designing efficient proof of storage system",
            "datalatte:desiredConnections": "Storage experts, Network engineers, Tokenomics specialists",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/storage",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "StorageNet",
                "schema:description": "Decentralized storage network with built-in incentives",
                "datalatte:type": "infrastructure",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Rust, IPFS, Substrate"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Steve Storage",
            "datalatte:background": "Distributed systems engineer, storage specialist",
            "datalatte:knowledgeDomain": "Decentralized Storage",
            "datalatte:privateDetails": "Built distributed storage system handling petabytes",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_storage_steve"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Metaverse Infrastructure Developer",
            "datalatte:projectDescription": "Building decentralized virtual world engine",
            "datalatte:challenge": "Scaling real-time interactions in decentralized space",
            "datalatte:desiredConnections": "3D developers, Network engineers, Game designers",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/metaverse",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "MetaEngine",
                "schema:description": "Decentralized metaverse engine",
                "datalatte:type": "metaverse",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Unity, WebGL, Solidity"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Meta Mark",
            "datalatte:background": "Game engine developer, Web3 architect",
            "datalatte:knowledgeDomain": "Metaverse Development",
            "datalatte:privateDetails": "Led development of popular VR game engine",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_meta_mark"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Cross-chain Bridge Security Researcher",
            "datalatte:projectDescription": "Developing secure cross-chain communication protocols",
            "datalatte:challenge": "Ensuring atomic transactions across different chains",
            "datalatte:desiredConnections": "Security researchers, Protocol developers, Cryptographers",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/bridge",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "SecureBridge",
                "schema:description": "Secure cross-chain bridge protocol",
                "datalatte:type": "infrastructure",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Rust, Solidity, zkSync"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Bob Bridge",
            "datalatte:background": "Security researcher with focus on cross-chain protocols",
            "datalatte:knowledgeDomain": "Bridge Security",
            "datalatte:privateDetails": "Audited major bridge protocols, prevented $10M hack",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_bridge_bob"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Supply Chain Blockchain Solutions Architect",
            "datalatte:projectDescription": "Developing transparent supply chain tracking system",
            "datalatte:challenge": "Integrating IoT devices with blockchain",
            "datalatte:desiredConnections": "Supply chain experts, IoT developers, Blockchain devs",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/supplychain",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "SupplyTrack",
                "schema:description": "Blockchain-based supply chain tracking platform",
                "datalatte:type": "supplychain",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Hyperledger, IoT, Node.js"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Sam Supply",
            "datalatte:background": "Supply chain manager turned blockchain developer",
            "datalatte:knowledgeDomain": "Supply Chain, IoT",
            "datalatte:privateDetails": "Implemented tracking system for Fortune 500 company",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_supply_sam"
            }
        }
    },
    {
        public: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/"
            },
            "@type": "datalatte:Intent",
            "@id": `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "datalatte:summary": "Decentralized Healthcare Data Platform Developer",
            "datalatte:projectDescription": "Building privacy-preserving health data sharing platform",
            "datalatte:challenge": "Ensuring HIPAA compliance with blockchain",
            "datalatte:desiredConnections": "Healthcare professionals, Privacy experts, Web3 devs",
            "datalatte:intentCategory": "professional",
            "schema:url": "https://example.com/healthcare",
            "datalatte:relatedTo": {
                "@type": "datalatte:Project",
                "@id": `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                "datalatte:revisionTimestamp": new Date().toISOString(),
                "foaf:name": "HealthChain",
                "schema:description": "Secure healthcare data sharing platform",
                "datalatte:type": "healthcare",
                "datalatte:projectDomain": "web3",
                "datalatte:techStack": "Solidity, ZK-proofs, FHIR"
            }
        },
        private: {
            "@context": {
                "schema": "http://schema.org/",
                "datalatte": "https://datalatte.com/ns/",
                "foaf": "http://xmlns.com/foaf/0.1/"
            },
            "@type": "foaf:Person",
            "@id": `urn:uuid:${uuidv4()}`,
            "datalatte:revisionTimestamp": new Date().toISOString(),
            "foaf:name": "Helen Health",
            "datalatte:background": "Healthcare IT specialist and privacy expert",
            "datalatte:knowledgeDomain": "Healthcare Data",
            "datalatte:privateDetails": "Developed EMR system used by 100+ clinics",
            "foaf:account": {
                "@type": "foaf:OnlineAccount",
                "foaf:accountServiceHomepage": "twitter",
                "foaf:accountName": "test_health_helen"
            }
        }
    }
];

async function publishSyntheticProfile(
  profile: any,
  profileName: string,
  DkgClient: any,
  attempt: number = 1
): Promise<boolean> {
  try {
    elizaLogger.info(`Publishing ${profileName} to DKG (Attempt ${attempt}/3)...`);
    
    // Generate IDs that will be used across both public and private parts
    const personId = `urn:uuid:${uuidv4()}`;
    const intentId = `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const projectId = `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Construct public part
    const publicData = {
      "@context": profile.public["@context"],
      "@type": "datalatte:Intent",
      "@id": intentId,
      "datalatte:revisionTimestamp": timestamp,
      "datalatte:summary": profile.public["datalatte:summary"],
      "datalatte:projectDescription": profile.public["datalatte:projectDescription"],
      "datalatte:challenge": profile.public["datalatte:challenge"],
      "datalatte:desiredConnections": profile.public["datalatte:desiredConnections"],
      "datalatte:intentCategory": "professional",
      "schema:url": profile.public["schema:url"],
      "datalatte:relatedTo": {
        "@type": "datalatte:Project",
        "@id": projectId,
        "datalatte:revisionTimestamp": timestamp,
        "foaf:name": profile.public["datalatte:relatedTo"]["foaf:name"],
        "schema:description": profile.public["datalatte:relatedTo"]["schema:description"],
        "datalatte:type": profile.public["datalatte:relatedTo"]["datalatte:type"],
        "datalatte:projectDomain": profile.public["datalatte:relatedTo"]["datalatte:projectDomain"],
        "datalatte:techStack": profile.public["datalatte:relatedTo"]["datalatte:techStack"]
      }
    };

    // Construct private part
    const privateData = {
      "@context": profile.private["@context"],
      "@type": "foaf:Person",
      "@id": personId,
      "datalatte:revisionTimestamp": timestamp,
      "foaf:name": profile.private["foaf:name"],
      "datalatte:background": profile.private["datalatte:background"],
      "datalatte:knowledgeDomain": profile.private["datalatte:knowledgeDomain"],
      "datalatte:privateDetails": profile.private["datalatte:privateDetails"],
      "datalatte:hasAccount": {
        "@type": "datalatte:Account",
        "datalatte:accountPlatform": "twitter",
        "datalatte:accountUsername": profile.private["foaf:account"]["foaf:accountName"]
      },
      "datalatte:hasIntent": {
        "@type": "datalatte:Intent",
        "@id": intentId
      },
      "datalatte:hasProject": {
        "@type": "datalatte:Project",
        "@id": projectId
      }
    };

    elizaLogger.info("Publishing public data:", publicData);
    elizaLogger.info("Publishing private data:", privateData);

    const createAssetResult = await DkgClient.asset.create(
      {
        public: publicData,
        private: privateData,
      },
      { epochsNum: 3 }
    );

    elizaLogger.info(`=== ${profileName} Knowledge Asset Created ===`);
    elizaLogger.info(`UAL: ${createAssetResult.UAL}`);
    elizaLogger.info(`DKG Explorer Link: ${process.env.DKG_ENVIRONMENT === 'mainnet' ?
      'https://dkg.origintrail.io/explore?ual=' :
      'https://dkg-testnet.origintrail.io/explore?ual='}${createAssetResult.UAL}`);
    elizaLogger.info("==========================================");
    
    return true;

  } catch (error) {
    elizaLogger.error(`Error publishing ${profileName} (Attempt ${attempt}/3):`);
    elizaLogger.error('Error message:', error.message);
    elizaLogger.error('Error stack:', error.stack);
    return false;
  }
}

export const simSynteticProfile: Action = {
  name: "SIM_SYNTHETIC_PROFILE",
  similes: ["SIMULATE_SYNTHETIC_PROFILE", "PUBLISH_SYNTHETIC_PROFILES", "LOAD_SYNTHETIC_DATA"],
  description: "Publishes synthetic profiles to DKG for testing and development purposes.",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const requiredEnvVars = [
      "DKG_ENVIRONMENT",
      "DKG_HOSTNAME",
      "DKG_PORT",
      "DKG_BLOCKCHAIN_NAME",
      "DKG_PUBLIC_KEY",
      "DKG_PRIVATE_KEY",
    ];

    const missingVars = requiredEnvVars.filter((varName) => !runtime.getSetting(varName));

    if (missingVars.length > 0) {
      elizaLogger.error(`Missing required environment variables: ${missingVars.join(", ")}`);
      return false;
    }

    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
    _options: { [key: string]: unknown },
    callback: HandlerCallback
  ): Promise<boolean> => {
    try {
      // Initialize DKG client if needed
      if (!DkgClient) {
        const config: DkgClientConfig = {
          environment: runtime.getSetting("DKG_ENVIRONMENT"),
          endpoint: runtime.getSetting("DKG_HOSTNAME"),
          port: runtime.getSetting("DKG_PORT"),
          blockchain: {
            name: runtime.getSetting("DKG_BLOCKCHAIN_NAME"),
            publicKey: runtime.getSetting("DKG_PUBLIC_KEY"),
            privateKey: runtime.getSetting("DKG_PRIVATE_KEY"),
          },
          maxNumberOfRetries: 300,
          frequency: 2,
          contentType: "all",
          nodeApiVersion: "/v1",
        };
        DkgClient = new DKG(config);
      }

      callback({
        text: "Starting to publish synthetic profiles to DKG...",
      });

      let successCount = 0;
      let failureCount = 0;

      for (let i = 3; i < syntheticProfiles.length; i++) {
        let success = false;
        let attempts = 0;
        
        // Try up to 3 times for each profile
        while (!success && attempts < 3) {
          attempts++;
          success = await publishSyntheticProfile(syntheticProfiles[i], `Profile ${i + 1}`, DkgClient, attempts);
          
          if (!success && attempts < 3) {
            // Wait for 5 seconds before retrying
            elizaLogger.info(`Waiting 5 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        
        if (success) {
          successCount++;
        } else {
          failureCount++;
          elizaLogger.warn(`Failed to publish Profile ${i + 1} after 3 attempts.`);
        }
        
        // Wait for 2 seconds between profiles regardless of success/failure
        if (i < syntheticProfiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      callback({
        text: `Finished publishing synthetic profiles. Successfully published ${successCount} profiles, failed to publish ${failureCount} profiles.`,
      });

      return true;

    } catch (error) {
      elizaLogger.error("Error in simSynteticProfile handler:", error);
      callback({
        text: "An error occurred while publishing synthetic profiles.",
      });
      return false;
    }
  },

  examples: [
    [
      {
        user: "DataBarista",
        content: {
          "text": "I'll help you publish synthetic profiles to DKG for testing.",
          "action": "(SIM_SYNTHETIC_PROFILE)"
        },
      }
    ]
  ] as ActionExample[][],
} as Action; 
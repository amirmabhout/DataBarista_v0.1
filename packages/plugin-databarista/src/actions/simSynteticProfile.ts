import {
  IAgentRuntime,
  Memory,
  State,
  elizaLogger,
  HandlerCallback,
  ActionExample,
  type Action,
  embed
} from "@elizaos/core";
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

// Define interface for profile version data
interface ProfileVersionData {
  public: any;
  private: any;
  timestamp: Date;
  embedding?: number[];
}

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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_alex_fittech"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_david_defi"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_zara_zk"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_maya_artist"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_carlos_coop"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_sophia_style"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_elena_edu"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_raj_farmer"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_leo_layer2"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_ian_identity"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_rachel_refi"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_nina_nft"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_tom_dao"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_sam_science"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_mike_music"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_iris_insurance"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "biiamorandi"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_sally_social"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_steve_storage"
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
                "foaf:accountServiceHomepage": "telegram",
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_bob_bridge"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_sam_supply"
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
                "foaf:accountServiceHomepage": "telegram",
                "foaf:accountName": "test_helen_health"
            }
        }
    }
];

/**
 * Generate embeddings for profile data using ElizaOS Core's embedding service
 * @param runtime Agent runtime for embedding service 
 * @param profileData Profile data to generate embeddings for
 * @returns Embedding vector as number array
 */
async function generateProfileEmbedding(
  runtime: IAgentRuntime,
  profileData: any
): Promise<number[] | null> {
  try {
    // Extract key fields from profile data to create a text representation
    const publicData = profileData.public || {};
    const privateData = profileData.private || {};
    
    // Combine the most important semantic fields for embedding
    const textToEmbed = [
      publicData["datalatte:summary"] || "",
      publicData["datalatte:intentCategory"] || "",
      publicData["datalatte:projectDescription"] || "",
      privateData["datalatte:background"] || "",
      privateData["datalatte:knowledgeDomain"] || "",
      privateData?.["datalatte:hasProject"]?.["datalatte:projectDomain"] || "",
      privateData?.["datalatte:hasProject"]?.["schema:description"] || "",
      // Join desired connections if it's an array
      Array.isArray(publicData["datalatte:desiredConnections"]) 
        ? publicData["datalatte:desiredConnections"].join(" ") 
        : (publicData["datalatte:desiredConnections"] || "")
    ].filter(Boolean).join(" ");
    
    if (!textToEmbed.trim()) {
      elizaLogger.warn("No meaningful text found to embed for profile");
      return null;
    }
    
    elizaLogger.info("Generated text for embedding:", textToEmbed.substring(0, 100) + "...");
    
    // Use ElizaOS Core embedding service
    const embedding = await embed(runtime, textToEmbed);
    if (embedding.length > 0) {
      elizaLogger.info(`Generated embedding vector with ${embedding.length} dimensions`);
      return embedding;
    } else {
      elizaLogger.warn("Embedding generation returned empty vector");
      return null;
    }
  } catch (error) {
    elizaLogger.error("Error generating profile embedding:", error);
    return null;
  }
}

async function publishSyntheticProfile(
  runtime: IAgentRuntime,
  profile: any,
  profileName: string,
  platform: string = "telegram",
  attempt: number = 1
): Promise<boolean> {
  try {
    elizaLogger.info(`Publishing ${profileName} to MongoDB CKG (Attempt ${attempt}/3)...`);
    
    // Generate IDs that will be used across both public and private parts
    const personId = `urn:uuid:${uuidv4()}`;
    const intentId = `urn:intent:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const projectId = `urn:project:int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    const username = profile.private.foaf?.account?.foaf?.accountName || 
                     profile.private?.["foaf:account"]?.["foaf:accountName"] || 
                     `synthetic_user_${Math.random().toString(36).substr(2, 9)}`;

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
        "datalatte:accountPlatform": platform,
        "datalatte:accountUsername": username
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

    elizaLogger.info("Publishing profile data for:", { platform, username });

    // Prepare current profile data version
    const currentProfileData: ProfileVersionData = {
        public: publicData,
        private: privateData,
      timestamp: new Date()
    };
    
    // Generate embedding for the profile data
    elizaLogger.info("Generating embedding for profile data");
    const embedding = await generateProfileEmbedding(runtime, currentProfileData);
    
    // Add embedding to profile data if available
    if (embedding) {
      currentProfileData.embedding = embedding;
      elizaLogger.info(`Added embedding vector with ${embedding.length} dimensions to profile`);
    }
    
    // Store the profile data using MongoDB
    const connectionString = runtime.getSetting('MONGODB_CONNECTION_STRING_CKG');
    const dbName = runtime.getSetting('MONGODB_DATABASE_CKG');
    
    if (!connectionString) {
      throw new Error('MONGODB_CONNECTION_STRING_CKG not set in environment');
    }
    
    if (!dbName) {
      throw new Error('MONGODB_DATABASE_CKG not set in environment');
    }
    
    const client = await new MongoClient(connectionString).connect();
    const db = client.db(dbName);
    const collection = db.collection(platform);
    
    // Find existing document for this user
    const existingDoc = await collection.findOne({ platform, username });
    
    let result;
    
    if (existingDoc) {
      // Document exists, append new profile version to the profileVersions array
      // and update latestProfile for search purposes
      elizaLogger.info("Updating existing profile document with new version", {
        platform,
        username
      });
      
      // Get existing profileVersions array or initialize if it doesn't exist
      const existingVersions = existingDoc.profileVersions || [];
      
      // Create a new array with existing versions plus the new one
      const updatedVersions = [...existingVersions, currentProfileData];
      
      result = await collection.updateOne(
        { platform, username },
        { 
          $set: { 
            latestProfile: currentProfileData,
            profileVersions: updatedVersions,
            lastUpdated: new Date()
          }
        }
      );
    } else {
      // Document doesn't exist, create new one with initial version
      elizaLogger.info("Creating new profile document", {
        platform,
        username
      });
      
      const profileDocument = {
        platform,
        username,
        latestProfile: currentProfileData,
        profileVersions: [currentProfileData],
        created: new Date(),
        lastUpdated: new Date()
      };
      
      result = await collection.insertOne(profileDocument);
    }
    
    await client.close();
    
    elizaLogger.info(`=== ${profileName} Successfully Stored in MongoDB CKG ===`);
    elizaLogger.info({
      updated: result.modifiedCount > 0,
      inserted: result.insertedCount > 0,
      versionCount: (existingDoc?.profileVersions?.length || 0) + 1,
      hasEmbedding: !!embedding,
      platform,
      username
    });
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
  description: "Publishes synthetic profiles to MongoDB CKG for testing and development purposes.",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const requiredEnvVars = [
      "MONGODB_CONNECTION_STRING_CKG",
      "MONGODB_DATABASE_CKG",
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
      callback({
        text: "Starting to publish synthetic profiles to MongoDB CKG...",
      });

      let successCount = 0;
      let failureCount = 0;

      // Process a subset of synthetic profiles (starting from index 3)
      for (let i = 0; i < syntheticProfiles.length; i++) {
        let success = false;
        let attempts = 0;
        
        // Try up to 3 times for each profile
        while (!success && attempts < 3) {
          attempts++;
          success = await publishSyntheticProfile(runtime, syntheticProfiles[i], `Profile ${i + 1}`, "telegram", attempts);
          
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
        text: `Finished publishing synthetic profiles to MongoDB CKG. Successfully published ${successCount} profiles, failed to publish ${failureCount} profiles.`,
      });

      return true;

    } catch (error) {
      elizaLogger.error("Error in simSynteticProfile handler:", error);
      callback({
        text: "An error occurred while publishing synthetic profiles to MongoDB CKG.",
      });
      return false;
    }
  },

  examples: [
    [
      {
        user: "DataBarista",
        content: {
          "text": "I'll help you publish synthetic profiles to the database for testing.",
          "action": "(SIM_SYNTHETIC_PROFILE)"
        },
      }
    ]
  ] as ActionExample[][],
} as Action; 
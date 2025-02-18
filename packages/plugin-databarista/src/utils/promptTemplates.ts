/**
 * Shared prompt templates used across DataBarista actions
 */

/**
 * Template for generating social media posts for matches
 */
export const MATCH_PROMPT_TEMPLATE = `
MATCHMAKING SOCIAL POST GENERATION TASK

User Profile Data:
{{userProfileData}}

Potential Match Data:
{{matchesData}}

Task:
From the above data, choose the best match that aligns with the user's interests.
Generate a friendly social media post that introduces the user and the best match together.
The post should:
1. Use the proper @username for both user (from user profile's accountName) and the best match chosen (from match's accountName)
2. Highlight their synergy and how they might help solve each other
3. Do not use hashtags

Return an array containing a single object with the following structure:

Example Output:
[{
  "post": "DataBarista here, serving you a double shot of innovation ☕️ @amirmabhout, meet @test_fitnessguy! @amirmabhout is designing a cutting-edge AI fitness coach, while @test_fitnessguy has a solid track record marketing innovative fitness products to a tech-enthused crowd. Together, your blend of smart design and strategic promotion has the potential to revolutionize how people engage with fitness technology. Let's see what groundbreaking ideas you can brew up!"
}]

Do not include any additional text or explanation outside of the array structure.
`;

/**
 * Template for generating SPARQL queries to find matching profiles
 */
export const MATCH_QUERY_TEMPLATE = `
You are a SPARQL query generator. Your task is to output a JSON array containing one object with a single property "query" whose value is a valid SPARQL query string.
Do not output any additional text or explanation.

SHACL Shape Reference:
{{shaclShapes}}

User Profile Data:
{{userProfileData}}

Task:
Generate a SPARQL query that finds potential matching profiles in the Decentralized Knowledge Graph (DKG) based on both the user profile and recent messages. The query must:

1. **Exclude the User's Own Profile:**  
   Filter out any ?person that has a foaf:account with both:  
   - foaf:accountServiceHomepage equal to "{{platform}}" (e.g. "telegram")  
   - foaf:accountName that matches "{{username}}" (case-insensitive)

2. **Dynamic Multiple-Keyword Filtering:**  
   Dynamically derive multiple keywords (at least two or three per field) from the user's profile and conversation context. For example:
   - For datalatte:knowledgeDomain: derive keywords from the user's "knowledgeDomain" (e.g. "Artificial Intelligence", "AI", "Machine Learning")
   - For datalatte:background: derive keywords from the user's "background" (e.g. "matchmaking", "ai agent", "feedback")
   - For datalatte:desiredConnections (bound as ?allDesiredConnections): derive keywords from the user's role or desired partner traits (e.g. "ai enthusiasts", "developer", "researcher")
   - For the project's domain (?projectDomain): derive keywords from the user's project domain (e.g. "Artificial Intelligence", "Machine Learning", "tech")

3. **Candidate Matching:**  
   Look for candidates where any of the following OPTIONAL fields (case-insensitive, using COALESCE to default missing values to an empty string) contain **at least one** of the derived keywords:
   - datalatte:knowledgeDomain
   - datalatte:background
   - datalatte:desiredConnections (bound as ?allDesiredConnections)
   - datalatte:domain from the related project

4. **Result Ordering and Limiting:**  
   Order results by the most recent intent timestamp and limit the results to 15.

5. **Select Clause:**  
   Ensure the SELECT clause returns:
   - ?person, ?accountName (as username), ?knowledgeDomain, ?background, ?allDesiredConnections, ?projectDomain, ?projectType, ?challenge, ?intentTimestamp, ?projectName, and ?projectDescription.

**Dynamic Filtering Section:**  
Construct the FILTER clause so that it checks if any candidate field (after applying COALESCE and LCASE) contains one or more of the derived keywords. Replace the placeholder keywords below with the actual values:
- For datalatte:knowledgeDomain: "{{kKeyword1}}", "{{kKeyword2}}", "{{kKeyword3}}"
- For datalatte:background: "{{bKeyword1}}", "{{bKeyword2}}", "{{bKeyword3}}"
- For datalatte:desiredConnections: "{{dKeyword1}}", "{{dKeyword2}}", "{{dKeyword3}}"
- For datalatte:domain: "{{pKeyword1}}", "{{pKeyword2}}", "{{pKeyword3}}"

**Example Output:**
[{
  "query": "PREFIX schema: <http://schema.org/> PREFIX datalatte: <https://datalatte.com/ns/> PREFIX foaf: <http://xmlns.com/foaf/0.1/> PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> SELECT DISTINCT ?person ?accountName ?knowledgeDomain ?background ?allDesiredConnections ?projectDomain ?projectType ?challenge ?intentTimestamp ?projectName ?projectDescription WHERE { { SELECT ?person (MAX(?ts) AS ?intentTimestamp) { ?person datalatte:hasIntent/datalatte:revisionTimestamp ?ts . } GROUP BY ?person } ?person a foaf:Person ; foaf:account ?account . ?account foaf:accountName ?accountName . OPTIONAL { ?person datalatte:knowledgeDomain ?knowledgeDomain. } OPTIONAL { ?person datalatte:background ?background. } OPTIONAL { ?person datalatte:hasIntent ?intent. } OPTIONAL { ?intent datalatte:desiredConnections ?allDesiredConnections ; datalatte:challenge ?challenge ; datalatte:relatedTo ?project . OPTIONAL { ?project datalatte:type ?projectType. } OPTIONAL { ?project datalatte:domain ?projectDomain. } OPTIONAL { ?project foaf:name ?projectName. } OPTIONAL { ?project schema:description ?projectDescription. } } FILTER NOT EXISTS { ?person foaf:account ?userAccount . ?userAccount foaf:accountServiceHomepage \"{{platform}}\" ; foaf:accountName ?userName . FILTER( LCASE(STR(?userName)) = LCASE(\"{{username}}\") ) } FILTER ( (CONTAINS(LCASE(COALESCE(STR(?knowledgeDomain), \"\")), LCASE(\"{{kKeyword1}}\")) || CONTAINS(LCASE(COALESCE(STR(?knowledgeDomain), \"\")), LCASE(\"{{kKeyword2}}\")) || CONTAINS(LCASE(COALESCE(STR(?knowledgeDomain), \"\")), LCASE(\"{{kKeyword3}}\"))) || (CONTAINS(LCASE(COALESCE(STR(?background), \"\")), LCASE(\"{{bKeyword1}}\")) || CONTAINS(LCASE(COALESCE(STR(?background), \"\")), LCASE(\"{{bKeyword2}}\")) || CONTAINS(LCASE(COALESCE(STR(?background), \"\")), LCASE(\"{{bKeyword3}}\"))) || (CONTAINS(LCASE(COALESCE(STR(?allDesiredConnections), \"\")), LCASE(\"{{dKeyword1}}\")) || CONTAINS(LCASE(COALESCE(STR(?allDesiredConnections), \"\")), LCASE(\"{{dKeyword2}}\")) || CONTAINS(LCASE(COALESCE(STR(?allDesiredConnections), \"\")), LCASE(\"{{dKeyword3}}\"))) || (CONTAINS(LCASE(COALESCE(STR(?projectDomain), \"\")), LCASE(\"{{pKeyword1}}\")) || CONTAINS(LCASE(COALESCE(STR(?projectDomain), \"\")), LCASE(\"{{pKeyword2}}\")) || CONTAINS(LCASE(COALESCE(STR(?projectDomain), \"\")), LCASE(\"{{pKeyword3}}\"))) ) } ORDER BY DESC(?intentTimestamp) LIMIT 15"
}]
`;

/**
 * Template for extracting knowledge graph data from conversations
 */
export const KG_EXTRACTION_TEMPLATE = `
TASK: Transform conversation data into valid schema.org/FOAF compliant JSON-LD for professional intentions, considering existing intentions in DKG

Recent Messages:
{{recentMessages}}

Existing knowledge related to the person:
{{userProfileData}}

SHACL Shapes for Validation:
{{shaclShapes}}

Guidelines:
1. First analyze if the intent and project from conversation matches or updates any existing intention and project:
   - If exact match exists (same core intention, no new details) -> return empty array
   - If similar intent/project exists but has new details -> use existing intention/project ID and merge details
   - If completely new intention/project -> use the provided new ID
2. For existing updates:
   - Keep all existing fields in the output
   - Add or update fields that have new information
   - Use the exact ID from the matching existing knowledge asset
3. For new intents and projects:
   - Use the provided new ID
   - Fill all fields that can be extracted from conversation
4. All fields must match their defined datatypes and value constraints

Format response as array:
[
  {
    "analysis": {
      "matchType": "exact_match" | "update_existing" | "new_information",
      "existingIntentionId": "<id of matching intention if update_existing>",
      "existingProjectId": "<id of matching project if update_existing>",
      "reason": "<explanation of the decision>"
    },
    "public": {
      "@context": {
        "schema": "http://schema.org/",
        "datalatte": "https://datalatte.com/ns/"
      },
      "@type": "datalatte:Intent",
      "@id": "urn:intent:{{intentid}}",
      "datalatte:revisionTimestamp": "{{timestamp}}",
      "datalatte:summary": "<Anonymized summary of what the user seeks, e.g., 'Seeking a marketing expert to scale digital outreach'>",
      "datalatte:desiredConnections": [
        "<expertise type1>",
        "<expertise type2>"
      ],
      "datalatte:projectDescription": "<Public description of the project, anonymized>",
      "datalatte:challenge": "<Summary of the challenge or goal user seeks>",
      "schema:url": "<Extracted URL if mentioned>",
      "datalatte:intentCategory": "professional",
      "datalatte:relatedTo": "urn:project:{{projectid}}"
    },
    "private": {
      "@context": {
        "schema": "http://schema.org/",
        "datalatte": "https://datalatte.com/ns/",
        "foaf": "http://xmlns.com/foaf/0.1/"
      },
      "@type": "foaf:Person",
      "@id": "urn:uuid:{{uuid}}",
      "datalatte:revisionTimestamp": "{{timestamp}}",
      "foaf:account": {
        "@type": "foaf:OnlineAccount",
        "foaf:accountServiceHomepage": "{{platform}}",
        "foaf:accountName": "{{username}}"
      },
      "datalatte:background": "<Private biography or contextual background (e.g., 'Founder of an AI analytics startup')>",
      "datalatte:knowledgeDomain": "<Primary field, e.g., 'Web3', 'DeFi', 'NFT'>",
      "datalatte:privateDetails": "<Any additional sensitive details>",
      "datalatte:hasIntent": {
        "@type": "datalatte:Intent",
        "@id": "urn:intent:{{intentid}}",
      },
      "datalatte:hasProject": {
        "@type": "datalatte:Project",
        "@id": "urn:project:{{projectid}}",
        "datalatte:revisionTimestamp": "{{timestamp}}",
        "foaf:name": "<Project title, e.g., 'NFT Art Marketplace'>",
        "schema:description": "<Project description summary>",
        "datalatte:type": "<Classification, e.g., 'marketplace', 'protocol', 'DAO tool', 'game', 'platform'>",
        "datalatte:domain": "<Project domain, e.g., 'Web3', 'blockchain', 'metaverse'>",
        "datalatte:techStack": "<Technical details or technology stack used>"
      }
    }
  }
]

- If nothing new is found or conversation does not reveal any information that can be extracted in this template, return []
- If updating existing intent or project, use that intention's ID instead of {{intentid}} as well as existing project's ID instead of {{projectid}}
- Exclude any field from the output if not found in conversation
`; 
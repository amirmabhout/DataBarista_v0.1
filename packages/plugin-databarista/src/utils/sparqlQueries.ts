/**
 * Shared SPARQL queries used across DataBarista actions
 */

/**
 * Query to get user profile data including intents and projects
 */

export const USER_PROFILE_QUERY = `
PREFIX schema:    <http://schema.org/>
PREFIX datalatte: <https://datalatte.com/ns/>
PREFIX foaf:      <http://xmlns.com/foaf/0.1/>
PREFIX rdf:       <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?person ?accountName ?accountPlatform ?name ?background ?knowledgeDomain ?privateDetails ?personTimestamp
       ?latestIntent ?intentTimestamp ?summary ?allDesiredConnections ?projDesc ?challenge ?url ?relatedProject
       ?latestProject ?projectTimestamp ?projectName ?projectDescriptionFull ?projectType ?projectDomain ?projectTechStack
WHERE {
  # Person info
  {
    SELECT ?person 
           (MAX(?pTs) AS ?personTimestamp)
           (MAX(?nameVal) AS ?name)
           (MAX(?bg) AS ?background)
           (MAX(?kd) AS ?knowledgeDomain)
           (MAX(?pd) AS ?privateDetails)
           (MAX(?accUsername) AS ?accountName)
           (MAX(?accPlatform) AS ?accountPlatform)
    WHERE {
      ?person rdf:type foaf:Person ;
              datalatte:hasAccount ?account .
      ?account a datalatte:Account ;
               datalatte:accountPlatform ?accPlatform ;
               datalatte:accountUsername ?accUsername .
      FILTER( LCASE(STR(?accPlatform)) = LCASE("{{platform}}") )
      FILTER( LCASE(STR(?accUsername)) = LCASE("{{username}}") )
      OPTIONAL { ?person foaf:name ?nameVal. }
      OPTIONAL { ?person datalatte:background ?bg. }
      OPTIONAL { ?person datalatte:knowledgeDomain ?kd. }
      OPTIONAL { ?person datalatte:privateDetails ?pd. }
      OPTIONAL { ?person datalatte:revisionTimestamp ?pTs. }
    }
    GROUP BY ?person
  }
  
  # Latest Intent Timestamp per person
  OPTIONAL {
    SELECT ?person (MAX(?it) AS ?intentTimestamp)
    WHERE {
      ?person datalatte:hasIntent ?i .
      ?i rdf:type datalatte:Intent ;
         datalatte:intentCategory "professional" ;
         datalatte:revisionTimestamp ?it .
    }
    GROUP BY ?person
  }
  
  # Latest Intent details joined on that timestamp
  OPTIONAL {
    ?person datalatte:hasIntent ?latestIntent .
    ?latestIntent rdf:type datalatte:Intent ;
                  datalatte:intentCategory "professional" ;
                  datalatte:revisionTimestamp ?intentTimestamp . 
    OPTIONAL { ?latestIntent datalatte:summary ?summary. }
    OPTIONAL { ?latestIntent datalatte:projectDescription ?projDesc. }
    OPTIONAL { ?latestIntent datalatte:challenge ?challenge. }
    OPTIONAL { ?latestIntent schema:url ?url. }
    OPTIONAL { ?latestIntent datalatte:relatedTo ?relatedProject. }
    OPTIONAL { ?latestIntent datalatte:desiredConnections ?allDesiredConnections }
  }
  
  # Latest Project Timestamp per person
  OPTIONAL {
    SELECT ?person (MAX(?pt) AS ?projectTimestamp)
    WHERE {
      ?person datalatte:hasProject ?p .
      ?p rdf:type datalatte:Project ;
         datalatte:revisionTimestamp ?pt .
    }
    GROUP BY ?person
  }
  
  # Latest Project details joined on that timestamp
  OPTIONAL {
    ?person datalatte:hasProject ?latestProject .
    ?latestProject rdf:type datalatte:Project ;
                   datalatte:revisionTimestamp ?projectTimestamp ;
                   foaf:name ?projectName ;
                   schema:description ?projectDescriptionFull ;
                   datalatte:type ?projectType ;
                   datalatte:domain ?projectDomain .
    OPTIONAL { ?latestProject datalatte:techStack ?projectTechStack. }
  }
}
ORDER BY DESC(?personTimestamp)
LIMIT 10
`;
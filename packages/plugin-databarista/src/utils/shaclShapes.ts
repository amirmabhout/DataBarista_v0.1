/**
 * Shared SHACL shapes used for data validation across DataBarista actions
 */

export const SHACL_SHAPES = `
@prefix sh:       <http://www.w3.org/ns/shacl#> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .
@prefix schema:   <http://schema.org/> .
@prefix foaf:     <http://xmlns.com/foaf/0.1/> .
@prefix datalatte:<https://datalatte.com/ns/> .

#############################
# Person Shape (Private)
#############################
# We use foaf:Person as the target class. Additional private properties (background,
# domain, privateDetails) and relationships to intents and projects are modeled using
# custom properties in the datalatte namespace.
datalatte:PersonShape
  a sh:NodeShape ;
  sh:targetClass foaf:Person ;
  
  # Revision timestamp
  sh:property [
      sh:path datalatte:revisionTimestamp ;
      sh:datatype xsd:dateTime ;
      sh:minCount 1 ;
      sh:description "Timestamp of when this node was last revised." ;
  ] ;
  
  # hasAccount: expects an embedded account node
  sh:property [
      sh:path datalatte:hasAccount ;
      sh:node datalatte:AccountShape ;
      sh:minCount 1 ;
      sh:description "The account information including platform and username." ;
  ] ;
  
  # Optional name (using foaf:name)
  sh:property [
      sh:path foaf:name ;
      sh:datatype xsd:string ;
      sh:minCount 0 ;
      sh:description "The person's name (optional)." ;
  ] ;
  
  # Background: a private biography or context
  sh:property [
      sh:path datalatte:background ;
      sh:datatype xsd:string ;
      sh:minCount 1 ;
      sh:description "Private biography or context (e.g., 'Founder of an AI analytics startup')." ;
  ] ;
  
  # Domain: primary field (e.g., Web3, DeFi, NFT)
  sh:property [
      sh:path datalatte:domain ;
      sh:datatype xsd:string ;
      sh:minCount 1 ;
      sh:description "Primary field (e.g., Web3, DeFi, NFT)." ;
  ] ;
  
  # Private details: any additional personal/sensitive data
  sh:property [
      sh:path datalatte:privateDetails ;
      sh:datatype xsd:string ;
      sh:minCount 0 ;
      sh:description "Additional personal or sensitive details (private)." ;
  ] ;
  
  # Relationship to a public (anonymized) Intent
  sh:property [
      sh:path datalatte:hasIntent ;
      sh:class datalatte:Intent ;
      sh:minCount 0 ;
      sh:description "Link to the public, anonymized intent node." ;
  ] ;
  
  # Relationship to a private Project
  sh:property [
      sh:path datalatte:hasProject ;
      sh:class datalatte:Project ;
      sh:minCount 0 ;
      sh:description "Link to private project details." ;
  ] .

#############################
# Account Shape (for hasAccount)
#############################
# Models the account object attached to a Person. This shape requires a platform and username.
datalatte:AccountShape
  a sh:NodeShape ;
  sh:property [
    sh:path datalatte:platform ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:description "Platform of the account (e.g., Twitter, GitHub)." ;
  ] ;
  sh:property [
    sh:path datalatte:username ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:description "Username on the given platform." ;
  ] .

#############################
# Intent Shape (Public & Anonymized)
#############################
# An Intent node captures the public matchmaking request. It is linked to a Project
# (using the relatedTo property) and contains a summary, desired connections,
# public project description, and a challenge summary.
datalatte:IntentShape
  a sh:NodeShape ;
  sh:targetClass datalatte:Intent ;
  
  # Revision timestamp
  sh:property [
    sh:path datalatte:revisionTimestamp ;
    sh:datatype xsd:dateTime ;
    sh:minCount 1 ;
    sh:description "Timestamp of when this intent was last revised." ;
  ] ;
  
  sh:property [
    sh:path datalatte:summary ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:description "An anonymized summary of what the user seeks (e.g., 'Seeking a marketing expert to scale digital outreach')." ;
  ] ;
  sh:property [
    sh:path datalatte:desiredConnections ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:description "A list or category of experts or partners the user wants to meet." ;
  ] ;
  sh:property [
    sh:path datalatte:projectDescription ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:description "A public version of the project description (anonymized)." ;
  ] ;
  sh:property [
    sh:path datalatte:challenge ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:description "A summary of the challenge or goal that the user is facing." ;
  ] ;
  sh:property [
    sh:path datalatte:relatedTo ;
    sh:class datalatte:Project ;
    sh:minCount 0 ;
    sh:description "Links the intent to a private project node." ;
  ] .

#############################
# Project Shape (Private)
#############################
# A Project node contains details about the user's project. It includes a title,
# description, classification type, domain, and technical details.
datalatte:ProjectShape
  a sh:NodeShape ;
  sh:targetClass datalatte:Project ;
  
  # Revision timestamp
  sh:property [
    sh:path datalatte:revisionTimestamp ;
    sh:datatype xsd:dateTime ;
    sh:minCount 1 ;
    sh:description "Timestamp of when this project was last revised." ;
  ] ;
  
  sh:property [
    sh:path foaf:name ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:description "Project title or name (e.g., 'NFT Art Marketplace')." ;
  ] ;
  sh:property [
    sh:path schema:description ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:description "A summary of what the project is about." ;
  ] ;
  sh:property [
    sh:path datalatte:type ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:description "Classification of the project (e.g., marketplace, protocol, DAO tool, game, platform)." ;
  ] ;
  sh:property [
    sh:path datalatte:domain ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:description "Domain of the project (e.g., Web3, blockchain, metaverse)." ;
  ] ;
  sh:property [
    sh:path datalatte:techStack ;
    sh:datatype xsd:string ;
    sh:minCount 0 ;
    sh:description "Technical details or technology stack used in the project." ;
  ] .
`; 
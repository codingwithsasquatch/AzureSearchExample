using Microsoft.Azure.Search;
using Microsoft.Azure.Search.Models;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;

namespace AzureSearchDocuments
{
    public class SearchClientHelper
    {
        private static SearchServiceClient _searchClient;

        private string IndexName;
        public static string errorMessage;

        public SearchClientHelper()
        {
            string searchServiceName = ConfigurationManager.AppSettings["SearchServiceName"];
            string searchServiceApiKey = ConfigurationManager.AppSettings["SearchServiceApiKey"];
            IndexName = ConfigurationManager.AppSettings["SearchIndex"];

            try
            { 
                _searchClient = new SearchServiceClient(searchServiceName, new SearchCredentials(searchServiceApiKey));
            }
            catch (Exception e)
            {
                errorMessage = e.Message.ToString();
            }
        }

        public JObject GetFacets(string searchText, string facetName, int maxCount = 30)
        {
            // Execute search based on query string
            try
            {
                SearchParameters sp = new SearchParameters()
                {
                    SearchMode = SearchMode.Any,
                    //Top = 0,
                    Facets = new List<String>() { $"{facetName}" },
                    QueryType = QueryType.Full
                };

                DocumentSearchResult response = _searchClient.Indexes.GetClient(IndexName).Documents.Search(searchText, sp);


                JObject dataset = new JObject();
                if (response != null)
                {
                    dataset =
     new JObject(
         new JProperty("facets",
         new JArray(
              from f in response.Facets
              select new JObject(
                  new JProperty("key", f.Key),
                  new JProperty("value",
                  new JArray( 
                   from v in f.Value
                   select new JObject(
                           new JProperty("type", v.Type),
                           new JProperty("from", v.From),
                           new JProperty("to", v.To),
                           new JProperty("value", v.Value),
                            new JProperty("count", v.Count)
                           ))),
  new JProperty("min", null),
   new JProperty("max", null),
    new JProperty("type", "System.String")
  ))),
  new JProperty("results",
  new JArray(
   from r in response.Results
   select new JObject(
        new JProperty("score", r.Score),
        new JProperty("highlights", r.Highlights),
        new JProperty("document", 
        new JObject(r.Document.Select(field => new JProperty(field.Key, field.Value)))
              )))),
  new JProperty("count", response.Results.Count)

);
                }

                return dataset;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error querying index: {0}\r\n", ex.Message.ToString());
            }
            return null;
        }

        private static string GetAppSetting(string key)
        {
            return Environment.GetEnvironmentVariable(key, EnvironmentVariableTarget.Process);
        }
    }
}

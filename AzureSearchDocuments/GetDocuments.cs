using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Search.Models;
using Newtonsoft.Json.Linq;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace AzureSearchDocuments
{
    [Produces("application/json")]
    [Route("api/[controller]")]
    [ApiController]
    public class GetDocuments : ControllerBase
    {
        private SearchClientHelper _searchHelper = new SearchClientHelper();

        // GET: api/<controller>
        [HttpGet]
        public JObject Get(string q, String facetName, int currentPage)
        {
            if (String.IsNullOrEmpty(facetName))
             facetName = "reference";

            if (String.IsNullOrEmpty(q))
                q = "*";

                JObject response = _searchHelper.GetFacets(q, facetName, 10);

            return response;            

        }

        // GET api/<controller>/5
        [HttpGet("{id}")]
        public string Get(int id)
        {
            return "value";
        }

        // POST api/<controller>
        [HttpPost]
        public void Post([FromBody]string value)
        {

        }

        // PUT api/<controller>/5
        [HttpPut("{id}")]
        public void Put(int id, [FromBody]string value)
        {
        }

        // DELETE api/<controller>/5
        [HttpDelete("{id}")]
        public void Delete(int id)
        {
        }
    }
}

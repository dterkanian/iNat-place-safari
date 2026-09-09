'''
Create iNat Safari JSON file.
Provide botanical name, common name, wikipedia URL (if given), taxon photos w/ attribution.
'''

import datetime
import json
import requests
import time

place_id = []
with open("places.json", "r", encoding="utf-8") as file:
    place_id_list = json.load(file)
    
place_id = ','.join([str(x) for x in place_id_list])
fields = "id,name"
url = f"https://api.inaturalist.org/v2/places/{place_id}?fields={fields}"

response = requests.get(url)
if response.status_code == 200:
    data = response.json()
    safari_json = {
        'places': data
    }

month_number = datetime.date.today().month
last_month_number = (month_number + 11) % 12
month_csv = ','.join([str(last_month_number), str(month_number)])
fields = "place_ids,taxon.native,taxon.name,taxon.preferred_common_name,taxon.wikipedia_url,photos.attribution,photos.url"

taxa_prelim = []

is_fetch_more_data = True
page_num=1
is_last_loop_rate_limited = False
sleep_duration_multiplier = 1
sleep_duration_base = 2
max_rank = 'complex'

while is_fetch_more_data:
    url = f"https://api.inaturalist.org/v2/observations?verifiable=true&hrank={max_rank}&place_id={place_id}&month={month_csv}&iconic_taxa=Plantae&fields={fields}&page={page_num}"
    print(url)
    response = requests.get(url)
    if response.status_code == 200:
        is_last_loop_rate_limited = False
        data = response.json()
        if 'results' in data.keys():
            print(f"Result count: {len(data['results'])}")
            if len(data['results']) == 0:
                is_fetch_more_data = False
            else:
                page_num += 1
                taxa_prelim.extend(data['results'])
        time.sleep(0.5) # try to avoid being rate limited (<100/minute)
    elif response.status_code == 429:
        sleep_duration = sleep_duration_base*sleep_duration_multiplier
        print(f'Rate limited, retrying in {sleep_duration} seconds...')
        time.sleep(sleep_duration) # respond to being rate limited
        if is_last_loop_rate_limited:
            sleep_duration_multiplier += 1
        is_last_loop_rate_limited = True
    else:
        print(f"{response.status_code} - {response.text}")

taxa = {}

if taxa_prelim:
    for d in taxa_prelim:
        taxon_id = d['taxon']['id']
        if taxon_id in taxa.keys():
            taxa[taxon_id]['count'] += 1
            taxa[taxon_id]['place_ids'].extend([x for x in place_id_list if x in d['place_ids'] and x not in taxa[taxon_id]['place_ids']])
        else:
            taxa[taxon_id] = {
                'count': 1, 
                'taxon': d['taxon'],
                'place_ids': [x for x in place_id_list if x in d['place_ids']],
                'photos': d['photos'],
                }

if taxa:
    taxa_list = [v for k,v in taxa.items()]
    safari_json['taxa'] = {'results': taxa_list}

if safari_json:
    with open("inat-safari.json", "w", encoding="utf-8") as file:
        json.dump(safari_json, file, indent=4)

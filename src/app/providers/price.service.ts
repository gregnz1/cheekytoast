import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import * as cheerio from 'cheerio';

@Injectable({ providedIn: 'root' })
export class PriceService {

  public constructor(private api: ApiService) {}

  public async getListingDetails(url: string): Promise<any> {

    return new Promise<any>(async (resolve) => {

      try {

        let html = '';
        html = await this.api.get(url);

        html = html.replaceAll('<!--%|%-->', '');
        html = html.replaceAll('<!--%+b:14%-->', '');
        html = html.replaceAll('<!--%-b:14%-->', '');
        html = html.replaceAll('<!--%+b:11%-->', '');
        html = html.replaceAll('<!--%-b:11%-->', '');

        const isValid = html.toLowerCase().includes('property details');

        if (isValid) {

          const titleInitial = html.split('data-test="listing-subtitle">')[1];
          const title = encodeURIComponent(titleInitial.split('<')[0]?.trim());

          console.log('title', title);

          const regionInitial = html.split('data-test="breadcrumbs__region">')[1];
          const region = regionInitial.split('<')[0]?.trim()?.toLowerCase()?.replace(' ', '-');

          console.log('region', region);

          const districtInitial = html.split('data-test="breadcrumbs__district">')[1];
          const district = districtInitial.split('<')[0]?.trim()?.toLowerCase()?.replace(' ', '-');

          console.log('district', district);

          const suburbInitial = html.split('data-test="breadcrumbs__suburb">')[1];
          const suburb = suburbInitial.split('<')[0]?.trim()?.toLowerCase()?.replace(' ', '-');

          console.log('suburb', suburb);

          resolve({ isValid, listingDetails:
            {
              title,
              region,
              district,
              suburb
            }
          });

        } else {

          resolve({ isValid: false });

        }

      } catch (error) {

        console.error(error);
        resolve({ isValid: false });

      }

    });

  }

  public async getListingPrice(listingDetails: any, min: number, max: number): Promise<any> {

    try {

      const promises = [];

      if (min === max) {

        promises.push(this.checkListingPrice(listingDetails, min, min));

      } else if ((max - min) === 1000) {

        promises.push(this.checkListingPrice(listingDetails, min, min));
        promises.push(this.checkListingPrice(listingDetails, max, max));

      } else {

        let numberOfLookups = 5;
        let increment = Math.round((max - min) / 5);

        if (increment % 1000 !== 0) {

          increment = 1000;
          numberOfLookups = Math.round((max - min) / 1000);

        }

        for (let index = 0; index < numberOfLookups; index++) {

          const newMin = index === 0 ? min : min + (increment * index);
          const newMax = increment + newMin;

          console.log('newMin', newMin);
          console.log('newMax', newMax);

          promises.push(this.checkListingPrice(listingDetails, newMin, newMax));

        }

      }

      const results = await Promise.race(promises);

      console.log('results', JSON.stringify(results, null, 2));

      if (results.isValid && (results.max - results.min) === 0) {

        return results;

      } else if (results.isValid && (results.max - results.min) !== 0) {

        // Some re-cursion magic
        return this.getListingPrice(listingDetails, results.min, results.max);

      } else {

        console.error('No Results Found');
        throw new Error('');

      }

    } catch (error) {

      console.error(error);
      throw new Error('No Results Found');

    }

  }

  private async checkListingPrice(listingDetails: any, min: number, max: number): Promise<any> {

    return new Promise<any>(async (resolve) => {

      const url = `https://www.realestate.co.nz/residential/sale/${listingDetails.region}/${listingDetails.district}/${listingDetails.suburb}?k="${listingDetails.title}"&minp=${min}&maxp=${max}`;

      try {

        let html = '';
        html = await this.api.get(url);
        const isValid = !html.toLowerCase().includes('nothing to see here');

        if (isValid) {

          resolve({ isValid, min, max });

        } else {

          // Delay resolving if price not found, so correct promise has time to resolve first
          setTimeout(() => {

            resolve({ isValid, min, max });

          }, 60000);

        }

      } catch (error) {

        console.error(error);
        resolve({ isValid: false });

      }

    });

  }

}


import {
  GRAPHQL_BROWSER_API_KEY,
  ORGANIZATION_ID,
  getApiUrl,
} from './api-config';
import { onError } from '@apollo/client/link/error';
import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';

// Create an error handling link
const errorLink = onError(({ error }) => {
  if (CombinedGraphQLErrors.is(error)) {
    error.errors.forEach(({ message, locations, path }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
    });
  } else {
    console.error(`[Network error]: ${error.message}`);
  }
});

// Create the HTTP link with the proper headers (no proxy)
const httpLink = new HttpLink({
  uri: getApiUrl(), // Direct URL (not proxied)
  headers: {
    'x-api-key': GRAPHQL_BROWSER_API_KEY,
    'x-organization-id': ORGANIZATION_ID,
  },
});

// Initialize Apollo Client
export const client = new ApolloClient({
  link: from([errorLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
  },
});

/**
 * Simple GraphQL client for making API calls
 */
interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

export async function graphqlRequest<T = unknown>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const url = getApiUrl();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': GRAPHQL_BROWSER_API_KEY,
        'x-organization-id': ORGANIZATION_ID,
        Origin: window.location.origin,
      },
      mode: 'cors',
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! Status: ${response.status}, Details: ${errorText}`
      );
    }

    const data = await response.json() as GraphQLResponse<T>;

    if (data.errors?.length) {
      throw new Error(
        data.errors.map((error) => error.message || "Unknown GraphQL error").join('\n')
      );
    }

    if (data.data === undefined) {
      throw new Error("GraphQL response did not contain data");
    }
    return data.data;
  } catch (error) {
    console.error('GraphQL request failed:', error);
    throw error;
  }
}

/**
 * Fetch centers
 */
export async function fetchCenters<T = unknown>(): Promise<T> {
  const query = `
    query Centers {
      centers {
        _id
        name
        phone
        location
        seqNo
        address {
          street
          city
          state
          country
          zip
        }
        organization {
          _id
          logo
          gstNumber
          panNumber
          brandName
          companyName
          socialLinks
        }
      }
    }
  `;

  return graphqlRequest(query);
}

/**
 * Search users by name, type, and center
 */
export async function searchUsers<T = unknown>(
  userType: string,
  centerId: string[],
  search?: string
): Promise<T> {
  const query = `
    query Users($userType: UserType, $centerId: [ObjectID!]!, $search: String) {
      users(userType: $userType, centerId: $centerId, search: $search) {
        _id
        profileData {
          ... on Patient {
            firstName
            lastName
          }
        }
      }
    }
  `;

  return graphqlRequest(query, {
    userType,
    centerId,
    search,
  });
}

/**
 * Search users with pagination - temporary function to avoid caching issues
 */
export async function searchUsersWithPagination<T = unknown>(
  userType: string,
  centerId: string[],
  search?: string
): Promise<T> {
  const query = `
    query Users(
      $userType: UserType!
      $centerId: [ObjectID!]!
      $search: String
      $filter: UserFilterInput
      $pagination: CursorPaginationInput
      $sort: UserSortInput
    ) {
      users(
        userType: $userType
        centerId: $centerId
        search: $search
        filter: $filter
        pagination: $pagination
        sort: $sort
      ) {
        data {
          _id
          seqNo
          phone
          email
          isActive
          userType
          profileData {
            ... on Patient {
              firstName
              lastName
              dob
              bio
              gender
              profilePicture
              status
              category
              cohort
              patientType
              __typename
            }
            __typename
          }
          __typename
        }
        pagination {
          nextCursor
          prevCursor
          hasNext
          hasPrevious
          limit
          __typename
        }
        __typename
      }
    }
  `;

  const variables = {
    userType,
    centerId,
    search: search || null,
    filter: null,
    pagination: {
      limit: 200,
      direction: 'FORWARD',
    },
    sort: {
      field: 'CREATED_AT',
      order: 'DESC',
    },
  };

  return graphqlRequest(query, variables);
}

/**
 * Fetch appointments for a patient using Reports query
 */
export async function fetchAppointments<T = unknown>(
  patientId: string
): Promise<T> {
  // Ensure patientId is provided
  if (!patientId) {
    throw new Error('Patient ID is required');
  }

  const query = `
    query Reports($patientId: ObjectID!) {
      reports(patientId: $patientId) {
        _id
        appointment {
          _id
          seqNo
          event {
            startTime
            endTime
          }
        }
      }
    }
  `;

  return graphqlRequest(query, { patientId });
}

// Export everything for centralized access
export default {
  client,
  graphqlRequest,
  fetchCenters,
  searchUsers,
  searchUsersWithPagination,
  fetchAppointments,
};

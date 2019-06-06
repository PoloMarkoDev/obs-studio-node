/******************************************************************************
    Copyright (C) 2016-2019 by Streamlabs (General Workings Inc)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

******************************************************************************/

#include "osn-Properties.hpp"
#include "error.hpp"
#include "obs.h"
#include "osn-source.hpp"
#include "shared.hpp"

void osn::Properties::Register(ipc::server& srv)
{
	std::shared_ptr<ipc::collection> cls = std::make_shared<ipc::collection>("Properties");
	cls->register_function(std::make_shared<ipc::function>(
	    "Modified", std::vector<ipc::type>{ipc::type::UInt64, ipc::type::String, ipc::type::String}, Modified));
	cls->register_function(std::make_shared<ipc::function>(
	    "Clicked", std::vector<ipc::type>{ipc::type::UInt64, ipc::type::String}, Clicked));
	srv.register_collection(cls);
}

void osn::Properties::Modified(
    void*                          data,
    const int64_t                  id,
    const std::vector<ipc::value>& args,
    std::vector<ipc::value>&       rval)
{
	uint64_t    sourceId = args[0].value_union.ui64;
	std::string name     = args[1].value_str;

	obs_source_t* source = osn::Source::Manager::GetInstance().find(sourceId);
	if (!source) {
		// Not expected to fail
		auto error_message = std::string(__PRETTY_FUNCTION__) + " invalid reference!";
		blog(LOG_ERROR, error_message.c_str());
		throw error_message;
	}
	obs_data_t* settings = obs_data_create_from_json(args[2].value_str.c_str());

	obs_properties_t* props = obs_source_properties(source);
	obs_property_t*   prop  = obs_properties_get(props, name.c_str());
	if (!prop) {
		rval.push_back(ipc::value((uint64_t)ErrorCode::Error));
		rval.push_back(ipc::value("Failed to find property in source."));
	} else {
		rval.push_back(ipc::value((uint64_t)ErrorCode::Ok));
		rval.push_back(ipc::value((int32_t)obs_property_modified(prop, settings)));
	}
	obs_properties_destroy(props);
	obs_data_release(settings);

	AUTO_DEBUG;
}

void osn::Properties::Clicked(
    void*                          data,
    const int64_t                  id,
    const std::vector<ipc::value>& args,
    std::vector<ipc::value>&       rval)
{
	uint64_t    sourceId = args[0].value_union.ui64;
	std::string name     = args[1].value_str;

	obs_source_t* source = osn::Source::Manager::GetInstance().find(sourceId);
	if (!source) {
		// Not expected to fail
		auto error_message = std::string(__PRETTY_FUNCTION__) + " invalid reference!";
		blog(LOG_ERROR, error_message.c_str());
		throw error_message;
	}

	obs_properties_t* props = obs_source_properties(source);
	obs_property_t*   prop  = obs_properties_get(props, name.c_str());
	if (!prop) {
		// Not expected to fail
		auto error_message = std::string(__PRETTY_FUNCTION__) + " failed to find property on source!";
		blog(LOG_ERROR, error_message.c_str());
		throw error_message;
	} else {
		rval.push_back(ipc::value((uint64_t)ErrorCode::Ok));
		rval.push_back(ipc::value((int32_t)obs_property_button_clicked(prop, source)));
	}
	obs_properties_destroy(props);

	AUTO_DEBUG;
}
